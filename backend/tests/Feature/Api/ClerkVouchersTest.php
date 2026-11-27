<?php

namespace Tests\Feature\Api;

use App\Models\Company;
use App\Models\Department;
use App\Models\PayeeType;
use App\Models\User;
use App\Models\VoucherCategory;
use App\Models\VoucherType;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Phase 3: a clerk's vouchers. Drafts with line items (total added up by the server, exact decimals),
 * edit, submit (numbering + state machine + officer notice), cancel, list, and the tenancy rules.
 *
 * Run:  php artisan test --filter=ClerkVouchersTest
 */
class ClerkVouchersTest extends TestCase
{
    use RefreshDatabase;

    private Company $apex;

    private Company $north;

    private User $clerk;

    private int $category;

    private int $payeeType;

    protected function setUp(): void
    {
        parent::setUp();
        $this->apex = Company::factory()->create(['name' => 'Apex Holdings Inc.']);
        $this->north = Company::factory()->create(['name' => 'Northfield']);
        $dept = Department::factory()->for($this->apex)->create(['name' => 'Finance']);
        $this->clerk = User::factory()->create(['first_name' => 'Maria', 'last_name' => 'Lopez', 'company_id' => $this->apex->id, 'department_id' => $dept->id]);
        $this->clerk->accessibleCompanies()->attach($this->apex->id, ['granted_status' => 'accepted']);
        $this->category = VoucherCategory::create(['company_id' => $this->apex->id, 'name' => 'Utilities'])->id;
        $this->payeeType = PayeeType::create(['company_id' => $this->apex->id, 'name' => 'Supplier'])->id;
    }

    private function api(string $method, string $uri, array $data = [], ?User $as = null, ?int $company = null)
    {
        return $this->actingAs($as ?? $this->clerk)->json($method, '/api/v1'.$uri, $data, ['X-Company-ID' => (string) ($company ?? $this->apex->id)]);
    }

    private function full(array $overrides = []): array
    {
        return array_merge([
            'category_id' => $this->category,
            'payment_method' => 'cash',
            'payee_name' => 'PLDT Inc.',
            'payee_type_id' => $this->payeeType,
            'description' => 'November internet bill',
            'line_items' => [
                ['description' => 'Fibr 1Gbps', 'quantity' => '1', 'unit' => 'month', 'unit_price' => '12980.00'],
                ['description' => 'Router rental', 'quantity' => '2.5', 'unit' => 'pc', 'unit_price' => '19.99'],
            ],
        ], $overrides);
    }

    public function test_form_options_are_this_companys_lists(): void
    {
        VoucherCategory::create(['company_id' => null, 'name' => 'Travel']);
        VoucherCategory::create(['company_id' => $this->north->id, 'name' => 'North only']);
        VoucherType::create(['company_id' => $this->north->id, 'name' => 'North type']);

        $this->api('GET', '/vouchers/form-options')
            ->assertOk()
            ->assertJsonCount(2, 'data.categories')
            ->assertJsonCount(0, 'data.voucher_types')
            ->assertJsonCount(1, 'data.payee_types')
            ->assertJsonPath('data.payment_methods', ['cash', 'bank', 'cheque']);
    }

    public function test_create_a_draft_the_server_adds_up_the_total_exactly(): void
    {
        $res = $this->api('POST', '/vouchers', $this->full(['amount' => '1.00']))
            ->assertCreated()
            ->assertJsonPath('data.status', 'draft')
            ->assertJsonPath('data.voucher_number', null)
            ->assertJsonPath('data.amount', '13029.98') // 12980.00 + 2.5 × 19.99 (49.975 → 49.98); a sent amount is ignored
            ->assertJsonPath('data.line_items.1.total_price', '49.98')
            ->assertJsonPath('data.names.department', 'Finance')
            ->assertJsonPath('data.can.submit', true);

        $this->assertDatabaseHas('vouchers', ['id' => $res->json('data.id'), 'company_id' => $this->apex->id, 'created_by' => $this->clerk->id]);
        $this->assertDatabaseHas('audit_logs', ['action' => 'voucher_created', 'record_id' => $res->json('data.id')]);
    }

    public function test_a_draft_can_be_incomplete_but_choices_must_be_this_companys(): void
    {
        $this->api('POST', '/vouchers', ['category_id' => $this->category, 'payment_method' => 'bank', 'line_items' => []])->assertCreated();

        $northCategory = VoucherCategory::create(['company_id' => $this->north->id, 'name' => 'X'])->id;
        $northPayee = PayeeType::create(['company_id' => $this->north->id, 'name' => 'X'])->id;
        $this->api('POST', '/vouchers', $this->full(['category_id' => $northCategory, 'payee_type_id' => $northPayee, 'payment_method' => 'gcash']))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['category_id', 'payee_type_id', 'payment_method']);

        $this->api('POST', '/vouchers', $this->full(['line_items' => [['description' => '', 'quantity' => '0', 'unit_price' => '1.234']]]))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['line_items.0.description', 'line_items.0.quantity', 'line_items.0.unit_price']);
    }

    public function test_submit_numbers_the_voucher_and_tells_the_officers(): void
    {
        $officer = User::factory()->officer()->create(['company_id' => $this->apex->id]);
        $officer->accessibleCompanies()->attach($this->apex->id, ['granted_status' => 'accepted']);
        $otherOfficer = User::factory()->officer()->create(['company_id' => $this->north->id]);

        $id = $this->api('POST', '/vouchers', $this->full())->json('data.id');
        $this->api('POST', "/vouchers/{$id}/submit")
            ->assertOk()
            ->assertJsonPath('data.status', 'pending')
            ->assertJsonPath('data.voucher_number', 'AHI-'.now()->year.'-0001')
            ->assertJsonPath('data.can.edit', false);

        $second = $this->api('POST', '/vouchers', $this->full())->json('data.id');
        $this->api('POST', "/vouchers/{$second}/submit")->assertJsonPath('data.voucher_number', 'AHI-'.now()->year.'-0002');

        $this->assertDatabaseHas('notifications', ['recipient_id' => $officer->id, 'type' => 'voucher_pending', 'voucher_id' => $id]);
        $this->assertDatabaseMissing('notifications', ['recipient_id' => $otherOfficer->id]);
        $this->assertDatabaseHas('audit_logs', ['action' => 'voucher_submitted', 'record_id' => $id]);

        // the state machine refuses a second submit and any edit now
        $this->api('POST', "/vouchers/{$id}/submit")->assertStatus(409)->assertJsonPath('code', 'INVALID_TRANSITION');
        $this->api('PATCH', "/vouchers/{$id}", $this->full())->assertStatus(409)->assertJsonPath('code', 'VOUCHER_LOCKED');
        $this->api('POST', "/vouchers/{$id}/cancel")->assertStatus(409);
    }

    public function test_submitting_an_incomplete_voucher_says_what_is_missing(): void
    {
        $id = $this->api('POST', '/vouchers', ['category_id' => $this->category, 'payment_method' => 'bank', 'line_items' => []])->json('data.id');

        $this->api('POST', "/vouchers/{$id}/submit")
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['payee_name', 'payee_type_id', 'description', 'bank_name', 'line_items']);
        $this->assertDatabaseHas('vouchers', ['id' => $id, 'status' => 'draft']);
    }

    public function test_a_returned_voucher_keeps_its_number_and_can_be_fixed_and_resubmitted(): void
    {
        $id = $this->api('POST', '/vouchers', $this->full())->json('data.id');
        $number = $this->api('POST', "/vouchers/{$id}/submit")->json('data.voucher_number');
        DB::table('vouchers')->where('id', $id)->update(['status' => 'returned']); // a reviewer sent it back (Phase 4)

        $updatedAt = $this->api('GET', "/vouchers/{$id}")->json('data.updated_at');
        $this->api('PATCH', "/vouchers/{$id}", $this->full(['description' => 'With receipt', 'updated_at' => $updatedAt]))->assertOk();
        $this->api('POST', "/vouchers/{$id}/submit")->assertOk()->assertJsonPath('data.voucher_number', $number);
    }

    public function test_returned_to_me_shows_the_reviewers_note_and_the_total_when_it_came_back(): void
    {
        $officer = User::factory()->create(['first_name' => 'Jose', 'last_name' => 'Ramos', 'role' => 'accounting_officer', 'company_id' => $this->apex->id]);
        $sendBack = function (int $id, string $note, string $at) use ($officer) {
            DB::table('vouchers')->where('id', $id)->update(['status' => 'returned']);
            DB::table('voucher_approvals')->insert([
                'voucher_id' => $id, 'approver_id' => $officer->id, 'step' => 1, 'role_at_time' => 'accounting_officer',
                'action' => 'returned', 'remarks' => $note, 'created_at' => $at, 'updated_at' => $at,
            ]);
        };

        $older = $this->api('POST', '/vouchers', $this->full())->json('data.id');
        $this->api('POST', "/vouchers/{$older}/submit")->assertOk();
        $newer = $this->api('POST', '/vouchers', $this->full(['payee_name' => 'Meralco']))->json('data.id');
        $this->api('POST', "/vouchers/{$newer}/submit")->assertOk();
        $sendBack($newer, 'Wrong month', now()->subHour()->toDateTimeString());
        $sendBack($older, 'Attach the bill', now()->subDays(2)->toDateTimeString());

        // the list: longest-waiting first, each with who sent it back and why
        $this->api('GET', '/vouchers?filter[view]=returned&sort=returned_oldest')->assertOk()
            ->assertJsonPath('data.0.id', $older)
            ->assertJsonPath('data.0.returned.by', 'Jose Ramos')
            ->assertJsonPath('data.0.returned.step', 1)
            ->assertJsonPath('data.0.returned.remarks', 'Attach the bill')
            ->assertJsonPath('data.1.id', $newer);
        $this->api('GET', '/vouchers?sort=nonsense')->assertStatus(422);

        // not edited yet: the total then = the total now
        $this->api('GET', "/vouchers/{$older}")->assertOk()
            ->assertJsonPath('data.returned.edited_since', false)
            ->assertJsonPath('data.returned.amount_at_return', '13029.98');

        // after a fix the old total is still known (from the audit trail)
        $updatedAt = $this->api('GET', "/vouchers/{$older}")->json('data.updated_at');
        $this->api('PATCH', "/vouchers/{$older}", $this->full([
            'updated_at' => $updatedAt,
            'line_items' => [['description' => 'Fibr 1Gbps', 'quantity' => '1', 'unit' => 'month', 'unit_price' => '12980.00']],
        ]))->assertOk()
            ->assertJsonPath('data.amount', '12980.00')
            ->assertJsonPath('data.returned.edited_since', true)
            ->assertJsonPath('data.returned.amount_at_return', '13029.98');

        // resubmitted: no longer returned, so no note
        $this->api('POST', "/vouchers/{$older}/submit")->assertOk()->assertJsonPath('data.returned', null);
    }

    public function test_edit_conflict_and_cancel(): void
    {
        $id = $this->api('POST', '/vouchers', $this->full())->json('data.id');
        $this->api('PATCH', "/vouchers/{$id}", $this->full(['updated_at' => '2020-01-01T00:00:00+08:00']))
            ->assertStatus(409)->assertJsonPath('code', 'VOUCHER_CHANGED');

        $this->api('POST', "/vouchers/{$id}/cancel")->assertOk()->assertJsonPath('data.status', 'cancelled');
        $this->assertDatabaseHas('audit_logs', ['action' => 'voucher_cancelled', 'record_id' => $id]);
    }

    public function test_list_views_search_and_counts(): void
    {
        $a = $this->api('POST', '/vouchers', $this->full(['payee_name' => 'PLDT Inc.']))->json('data.id');
        $this->api('POST', '/vouchers', $this->full(['payee_name' => 'Manila Water']))->json('data.id');
        $this->api('POST', "/vouchers/{$a}/submit");

        $this->api('GET', '/vouchers')->assertOk()->assertJsonCount(2, 'data')
            ->assertJsonPath('meta.counts.all', 2)->assertJsonPath('meta.counts.draft', 1)->assertJsonPath('meta.counts.in_review', 1);
        $this->api('GET', '/vouchers?filter[view]=draft')->assertJsonCount(1, 'data')->assertJsonPath('data.0.payee_name', 'Manila Water');
        $this->api('GET', '/vouchers?search=pldt')->assertJsonCount(1, 'data');
        $this->api('GET', '/vouchers?search=13,029.98')->assertJsonCount(2, 'data');
        $this->api('GET', '/vouchers?filter[view]=bogus')->assertUnprocessable();
    }

    public function test_other_clerks_and_other_companies_vouchers_are_404(): void
    {
        $id = $this->api('POST', '/vouchers', $this->full())->json('data.id');

        $other = User::factory()->create(['company_id' => $this->apex->id]);
        $other->accessibleCompanies()->attach($this->apex->id, ['granted_status' => 'accepted']);
        $this->api('GET', "/vouchers/{$id}", [], $other)->assertNotFound();
        $this->api('POST', "/vouchers/{$id}/submit", [], $other)->assertNotFound();
        $this->api('GET', '/vouchers', [], $other)->assertJsonCount(0, 'data');

        // the same clerk, working in another company, doesn't see it either
        $this->clerk->accessibleCompanies()->attach($this->north->id, ['granted_status' => 'accepted']);
        $this->api('GET', "/vouchers/{$id}", [], null, $this->north->id)->assertNotFound();
        $this->api('GET', '/vouchers', [], null, $this->north->id)->assertJsonCount(0, 'data');
    }

    public function test_who_may_use_vouchers_and_approval_rules(): void
    {
        $this->getJson('/api/v1/vouchers')->assertUnauthorized();
        $admin = User::factory()->admin()->create(['company_id' => $this->apex->id]);
        $this->api('GET', '/vouchers', [], $admin)->assertForbidden();
        $this->actingAs($this->clerk)->getJson('/api/v1/vouchers')->assertStatus(400); // no company chosen

        $this->actingAs($this->clerk)->getJson('/api/v1/approval-rules')
            ->assertOk()
            ->assertJsonPath('data.high_value_threshold', '50000.00')
            ->assertJsonPath('data.reviewing_live', true)->assertJsonPath('data.review_sla_hours', 48);
    }
}
