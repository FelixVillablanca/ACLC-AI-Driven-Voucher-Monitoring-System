<?php

namespace Tests\Feature\Api;

use App\Models\Company;
use App\Models\PayeeType;
use App\Models\User;
use App\Models\VoucherCategory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Payees (2026-11-26, Framer jbj8yIDz9 / GZb92vr4M / UKm7GrwEZ): the company's list, kept by its clerks.
 * Numbers count only the signed-in clerk's own vouchers. Run:  php artisan test --filter=ClerkPayeesTest
 */
class ClerkPayeesTest extends TestCase
{
    use RefreshDatabase;

    private Company $apex;

    private Company $north;

    private User $clerk;

    private User $other;

    private int $supplier;

    private int $utility;

    private int $category;

    protected function setUp(): void
    {
        parent::setUp();
        $this->apex = Company::factory()->create(['name' => 'Apex Holdings Inc.']);
        $this->north = Company::factory()->create(['name' => 'Northfield']);
        $this->clerk = User::factory()->create(['first_name' => 'Maria', 'last_name' => 'Lopez', 'company_id' => $this->apex->id]);
        $this->other = User::factory()->create(['first_name' => 'Juan', 'last_name' => 'Cruz', 'company_id' => $this->apex->id]);
        foreach ([$this->clerk, $this->other] as $u) {
            $u->accessibleCompanies()->attach($this->apex->id, ['granted_status' => 'accepted']);
        }
        $this->supplier = PayeeType::create(['company_id' => $this->apex->id, 'name' => 'Supplier'])->id;
        $this->utility = PayeeType::create(['company_id' => $this->apex->id, 'name' => 'Utility'])->id;
        $this->category = VoucherCategory::create(['company_id' => $this->apex->id, 'name' => 'Utilities'])->id;
    }

    private function api(string $method, string $uri, array $data = [], ?User $as = null, ?int $company = null)
    {
        return $this->actingAs($as ?? $this->clerk)->json($method, '/api/v1'.$uri, $data, ['X-Company-ID' => (string) ($company ?? $this->apex->id)]);
    }

    private function add(array $overrides = [], ?User $as = null)
    {
        return $this->api('POST', '/payees', array_merge([
            'name' => 'Meralco', 'payee_type_id' => $this->utility, 'tin' => '000101528', 'default_payment_method' => 'cheque',
            'address' => 'Ortigas Ave., Pasig City', 'email' => 'billing@meralco.ph',
        ], $overrides), $as);
    }

    private function voucher(int $payeeId, User $by, string $status, string $amount): void
    {
        $id = $this->api('POST', '/vouchers', [
            'payee_id' => $payeeId, 'category_id' => $this->category, 'payment_method' => 'cheque',
            'line_items' => [['description' => 'Bill', 'quantity' => '1', 'unit_price' => $amount]],
        ], $by)->assertCreated()->json('data.id');
        DB::table('vouchers')->where('id', $id)->update(['status' => $status, 'submitted_at' => now(), 'approved_at' => $status === 'approved' ? now() : null]);
    }

    public function test_add_a_payee_the_tin_is_tidied_and_duplicates_are_refused(): void
    {
        $this->add()->assertCreated()
            ->assertJsonPath('data.name', 'Meralco')
            ->assertJsonPath('data.tin', '000-101-528-000')
            ->assertJsonPath('data.type.name', 'Utility')
            ->assertJsonPath('data.added_by', 'Maria Lopez');
        $this->assertDatabaseHas('audit_logs', ['action' => 'payee_created', 'table_name' => 'payees']);

        // same name (other letter case) or same TIN in the same company
        $this->add(['name' => 'MERALCO', 'tin' => null])->assertStatus(422)->assertJsonValidationErrors('name');
        $this->add(['name' => 'Manila Electric', 'tin' => '000-101-528-000'])->assertStatus(422)->assertJsonValidationErrors('tin');
        // required fields, TIN shape, another company's type, email
        $this->add(['name' => '', 'payee_type_id' => null, 'tin' => '12-34', 'email' => 'nope'])->assertStatus(422)
            ->assertJsonValidationErrors(['name', 'payee_type_id', 'tin', 'email']);
        $northType = PayeeType::create(['company_id' => $this->north->id, 'name' => 'Supplier'])->id;
        $this->add(['name' => 'X', 'tin' => null, 'payee_type_id' => $northType])->assertStatus(422)->assertJsonValidationErrors('payee_type_id');
    }

    public function test_similar_payees_are_found_while_typing(): void
    {
        $this->add(['name' => "Juan's Catering Services", 'payee_type_id' => $this->supplier, 'tin' => '211904556000'])->assertCreated();

        $this->api('GET', '/payees/similar?name='.urlencode('Juans Catering Svcs.'))->assertOk()
            ->assertJsonPath('data.0.name', "Juan's Catering Services")
            ->assertJsonPath('data.0.reason', 'same_name');
        $this->api('GET', '/payees/similar?name=Totally+Different&tin=211-904-556-000')->assertOk()->assertJsonPath('data.0.reason', 'same_tin');
        $this->api('GET', '/payees/similar?name=Office+Warehouse')->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_list_counts_only_my_vouchers_and_filters_by_type(): void
    {
        $meralco = $this->add()->json('data.id');
        $grab = $this->add(['name' => 'Grab for Business', 'payee_type_id' => $this->supplier, 'tin' => null, 'default_payment_method' => 'bank'])->json('data.id');

        $this->voucher($meralco, $this->clerk, 'approved', '1000.50');
        $this->voucher($meralco, $this->clerk, 'pending', '200.00');
        $this->voucher($meralco, $this->other, 'approved', '99999.00'); // another clerk's: not counted for me

        $res = $this->api('GET', '/payees')->assertOk()
            ->assertJsonPath('data.0.id', $meralco) // most used first
            ->assertJsonPath('data.0.stats.vouchers_count', 2)
            ->assertJsonPath('data.0.stats.approved_ytd', '1000.50')
            ->assertJsonPath('data.1.id', $grab)
            ->assertJsonPath('meta.counts.all', 2);
        $this->assertSame(1, collect($res->json('meta.counts.types'))->firstWhere('name', 'Supplier')['count']);

        $this->api('GET', "/payees?filter[type]={$this->supplier}")->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $grab);
        $this->api('GET', '/payees?search=101528')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $meralco);

        // the other clerk sees the same payees, with their own numbers
        $this->api('GET', '/payees', as: $this->other)->assertOk()->assertJsonPath('data.0.stats.approved_ytd', '99999.00');

        // side panel: my recent vouchers only
        $this->api('GET', "/payees/{$meralco}")->assertOk()->assertJsonCount(2, 'data.recent_vouchers')->assertJsonPath('data.usual_category', 'Utilities');

        $this->api('GET', '/payees/export?format=csv')->assertOk()->assertHeader('Content-Type', 'text/csv; charset=UTF-8');
        $this->assertDatabaseHas('audit_logs', ['action' => 'payees_exported']);
    }

    public function test_edit_with_conflict_check_and_deactivate(): void
    {
        $payee = $this->add()->json('data');
        $this->travel(2)->seconds(); // updated_at has whole seconds: make the edit a different version

        $this->api('PATCH', "/payees/{$payee['id']}", [
            'name' => 'Meralco (Manila Electric)', 'payee_type_id' => $this->utility, 'default_payment_method' => 'bank',
            'bank_name' => 'BDO', 'bank_account_number' => '3810-2245-91', 'updated_at' => $payee['updated_at'],
        ], $this->other)->assertOk()->assertJsonPath('data.name', 'Meralco (Manila Electric)')->assertJsonPath('data.tin', null);
        $audit = DB::table('audit_logs')->where('action', 'payee_updated')->latest('id')->value('new_values');
        $this->assertStringContainsString('4591', $audit);
        $this->assertStringNotContainsString('3810-2245-91', $audit); // the account number is masked in the log

        // saving the old version again = someone changed it meanwhile
        $this->api('PATCH', "/payees/{$payee['id']}", ['name' => 'Meralco', 'payee_type_id' => $this->utility, 'updated_at' => $payee['updated_at']])
            ->assertStatus(409)->assertJsonPath('code', 'PAYEE_CHANGED');

        $this->api('POST', "/payees/{$payee['id']}/deactivate")->assertOk()->assertJsonPath('data.is_active', false);
        $this->api('POST', "/payees/{$payee['id']}/deactivate")->assertStatus(409)->assertJsonPath('code', 'PAYEE_ALREADY_INACTIVE');
        $this->api('GET', '/payees')->assertJsonCount(0, 'data');
        $this->api('GET', '/payees?filter[status]=inactive')->assertJsonCount(1, 'data');
        // a deactivated payee can't be put on a new voucher
        $this->api('POST', '/vouchers', ['payee_id' => $payee['id'], 'category_id' => $this->category, 'payment_method' => 'cash', 'line_items' => []])
            ->assertStatus(422)->assertJsonValidationErrors('payee_id');
        $this->api('POST', "/payees/{$payee['id']}/reactivate")->assertOk()->assertJsonPath('data.is_active', true);
    }

    public function test_vouchers_link_to_saved_payees(): void
    {
        $id = $this->add()->json('data.id');

        // chosen from the list: the saved name is used
        $this->api('POST', '/vouchers', ['payee_id' => $id, 'payee_name' => 'whatever', 'category_id' => $this->category, 'payment_method' => 'cash', 'line_items' => []])
            ->assertCreated()->assertJsonPath('data.payee_id', $id)->assertJsonPath('data.payee_name', 'Meralco');
        // typed exactly (any letter case): linked too; a new name: no link
        $this->api('POST', '/vouchers', ['payee_name' => 'meralco', 'category_id' => $this->category, 'payment_method' => 'cash', 'line_items' => []])
            ->assertJsonPath('data.payee_id', $id);
        $this->api('POST', '/vouchers', ['payee_name' => 'Someone New', 'category_id' => $this->category, 'payment_method' => 'cash', 'line_items' => []])
            ->assertJsonPath('data.payee_id', null);

        $this->api('GET', '/vouchers/form-options')->assertOk()->assertJsonPath('data.payees.0.name', 'Meralco');
    }

    public function test_tenancy_and_roles(): void
    {
        $id = $this->add()->json('data.id');
        $northClerk = User::factory()->create(['company_id' => $this->north->id]);
        $northClerk->accessibleCompanies()->attach($this->north->id, ['granted_status' => 'accepted']);

        $this->api('GET', "/payees/{$id}", as: $northClerk, company: $this->north->id)->assertNotFound();
        $northType = PayeeType::create(['company_id' => $this->north->id, 'name' => 'Supplier'])->id;
        $this->api('PATCH', "/payees/{$id}", ['name' => 'X', 'payee_type_id' => $northType], $northClerk, $this->north->id)->assertNotFound();
        $this->api('GET', '/payees', as: $northClerk, company: $this->apex->id)->assertForbidden(); // no access to Apex

        $officer = User::factory()->create(['role' => 'accounting_officer', 'company_id' => $this->apex->id]);
        $officer->accessibleCompanies()->attach($this->apex->id, ['granted_status' => 'accepted']);
        $this->api('GET', '/payees', as: $officer)->assertForbidden();

        auth()->forgetGuards();
        $this->json('GET', '/api/v1/payees', [], ['X-Company-ID' => (string) $this->apex->id])->assertUnauthorized();
    }
}
