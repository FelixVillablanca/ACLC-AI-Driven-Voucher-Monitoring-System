<?php

namespace Tests\Feature\Api;

use App\Models\Company;
use App\Models\PayeeType;
use App\Models\User;
use App\Models\VoucherCategory;
use App\Models\VoucherType;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Configuration → Categories: voucher categories, voucher types and payee types on one page.
 * Only the Admin's own company; built-in categories are read-only.
 *
 * Run:  php artisan test --filter=AdminCatalogTest
 */
class AdminCatalogTest extends TestCase
{
    use RefreshDatabase;

    private const URL = '/api/v1/admin/catalog';

    private Company $apex;

    private Company $north;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->apex = Company::factory()->create(['name' => 'Apex']);
        $this->north = Company::factory()->create(['name' => 'Northfield']);
        $this->admin = User::factory()->admin()->create(['company_id' => $this->apex->id]);
    }

    public function test_lists_the_three_lists_for_the_admins_company_plus_built_in_categories(): void
    {
        VoucherCategory::create(['company_id' => $this->apex->id, 'name' => 'Office supplies', 'code' => 'OFF']);
        VoucherCategory::create(['company_id' => null, 'name' => 'Travel', 'code' => 'TRV']);
        VoucherCategory::create(['company_id' => $this->north->id, 'name' => 'North only']);
        VoucherType::create(['company_id' => $this->apex->id, 'name' => 'Cash advance']);
        VoucherType::create(['company_id' => $this->north->id, 'name' => 'North type']);
        PayeeType::create(['company_id' => $this->apex->id, 'name' => 'Supplier']);

        $this->actingAs($this->admin)->getJson(self::URL)
            ->assertOk()
            ->assertJsonCount(2, 'data.categories')
            ->assertJsonPath('data.categories.0.name', 'Office supplies')
            ->assertJsonPath('data.categories.0.built_in', false)
            ->assertJsonPath('data.categories.1.built_in', true)
            ->assertJsonCount(1, 'data.voucher_types')
            ->assertJsonCount(1, 'data.payee_types')
            ->assertJsonPath('data.payee_types.0.vouchers_count', 0);
    }

    public function test_add_items_to_each_list_and_it_shows_in_recent_activity(): void
    {
        $this->actingAs($this->admin)->postJson(self::URL.'/categories', ['name' => '  Office  supplies ', 'code' => 'off', 'description' => 'Pens'])
            ->assertCreated()->assertJsonPath('data.name', 'Office supplies')->assertJsonPath('data.code', 'OFF')->assertJsonPath('data.is_active', true);
        $this->actingAs($this->admin)->postJson(self::URL.'/voucher_types', ['name' => 'Reimbursement', 'company_id' => $this->north->id])->assertCreated();
        $this->actingAs($this->admin)->postJson(self::URL.'/payee_types', ['name' => 'Supplier'])->assertCreated();

        $this->assertDatabaseHas('voucher_types', ['name' => 'Reimbursement', 'company_id' => $this->apex->id, 'created_by' => $this->admin->id]);
        $this->assertSame(3, DB::table('audit_logs')->where('action', 'catalog_created')->count());

        // the dashboard's "no payee types yet" warning goes away
        $this->actingAs($this->admin)->getJson('/api/v1/admin/dashboard')
            ->assertJsonPath('data.needs_attention', [])
            ->assertJsonPath('data.recent_activity.0.entity', 'payee_types')
            ->assertJsonPath('data.recent_activity.0.subject', 'Supplier');
    }

    public function test_names_and_codes_are_unique_per_company_and_vs_built_in(): void
    {
        VoucherCategory::create(['company_id' => null, 'name' => 'Travel', 'code' => 'TRV']);
        PayeeType::create(['company_id' => $this->apex->id, 'name' => 'Supplier']);
        PayeeType::create(['company_id' => $this->north->id, 'name' => 'Employee']);

        $this->actingAs($this->admin)->postJson(self::URL.'/categories', ['name' => 'TRAVEL', 'code' => 'trv'])
            ->assertUnprocessable()->assertJsonValidationErrors(['name', 'code']);
        $this->actingAs($this->admin)->postJson(self::URL.'/payee_types', ['name' => 'supplier'])
            ->assertUnprocessable()->assertJsonPath('errors.name.0', 'Your company already has one with this name.');
        $this->actingAs($this->admin)->postJson(self::URL.'/payee_types', ['name' => 'Employee'])->assertCreated(); // other company's name is fine
        $this->actingAs($this->admin)->postJson(self::URL.'/payee_types', ['name' => ''])->assertUnprocessable();
        $this->actingAs($this->admin)->postJson(self::URL.'/banks', ['name' => 'X'])->assertNotFound();
    }

    public function test_edit_with_conflict_check_and_unchanged_name_is_allowed(): void
    {
        $type = VoucherType::create(['company_id' => $this->apex->id, 'name' => 'Cash advance']);

        $this->actingAs($this->admin)->patchJson(self::URL."/voucher_types/{$type->id}", ['name' => 'Cash advance'])
            ->assertOk()->assertJsonPath('meta.changed', []);
        $this->actingAs($this->admin)->patchJson(self::URL."/voucher_types/{$type->id}", ['name' => 'Cash Advance (staff)', 'updated_at' => $type->updated_at->toIso8601String()])
            ->assertOk()->assertJsonPath('meta.changed', ['name']);
        $this->actingAs($this->admin)->patchJson(self::URL."/voucher_types/{$type->id}", ['name' => 'Other', 'updated_at' => '2020-01-01T00:00:00+08:00'])
            ->assertStatus(409)->assertJsonPath('code', 'CATALOG_CHANGED');
    }

    public function test_delete_only_when_unused(): void
    {
        $category = VoucherCategory::create(['company_id' => $this->apex->id, 'name' => 'Office supplies']);
        $type = PayeeType::create(['company_id' => $this->apex->id, 'name' => 'Supplier']);
        DB::table('vouchers')->insert([
            'voucher_number' => 'V-1', 'payment_method' => 'cash', 'category_id' => $category->id, 'payee_type_id' => $type->id,
            'status' => 'draft', 'company_id' => $this->apex->id, 'created_at' => now(), 'updated_at' => now(),
        ]);

        $this->actingAs($this->admin)->deleteJson(self::URL."/payee_types/{$type->id}")
            ->assertStatus(409)->assertJsonPath('code', 'CATALOG_IN_USE');
        $this->actingAs($this->admin)->getJson(self::URL)->assertJsonPath('data.payee_types.0.vouchers_count', 1);

        $unused = VoucherType::create(['company_id' => $this->apex->id, 'name' => 'Petty cash']);
        $this->actingAs($this->admin)->deleteJson(self::URL."/voucher_types/{$unused->id}")->assertNoContent();
        $this->assertDatabaseMissing('voucher_types', ['id' => $unused->id]);
        $this->assertDatabaseHas('audit_logs', ['action' => 'catalog_deleted', 'table_name' => 'voucher_types']);
    }

    public function test_categories_deactivate_and_reactivate(): void
    {
        $category = VoucherCategory::create(['company_id' => $this->apex->id, 'name' => 'Office supplies']);

        $this->actingAs($this->admin)->postJson(self::URL."/categories/{$category->id}/deactivate")->assertOk()->assertJsonPath('data.is_active', false);
        $this->actingAs($this->admin)->postJson(self::URL."/categories/{$category->id}/deactivate")->assertStatus(409)->assertJsonPath('code', 'CATALOG_ALREADY_INACTIVE');
        $this->actingAs($this->admin)->postJson(self::URL."/categories/{$category->id}/reactivate")->assertOk()->assertJsonPath('data.is_active', true);
    }

    public function test_built_in_and_other_companies_items_are_404(): void
    {
        $builtIn = VoucherCategory::create(['company_id' => null, 'name' => 'Travel']);
        $north = PayeeType::create(['company_id' => $this->north->id, 'name' => 'Employee']);

        $this->actingAs($this->admin)->patchJson(self::URL."/categories/{$builtIn->id}", ['name' => 'Mine'])->assertNotFound();
        $this->actingAs($this->admin)->postJson(self::URL."/categories/{$builtIn->id}/deactivate")->assertNotFound();
        $this->actingAs($this->admin)->deleteJson(self::URL."/categories/{$builtIn->id}")->assertNotFound();
        $this->actingAs($this->admin)->patchJson(self::URL."/payee_types/{$north->id}", ['name' => 'Mine'])->assertNotFound();
        $this->actingAs($this->admin)->deleteJson(self::URL."/payee_types/{$north->id}")->assertNotFound();
        $this->assertDatabaseHas('payee_types', ['id' => $north->id, 'name' => 'Employee']);
    }

    public function test_guests_are_401_and_other_roles_403(): void
    {
        $this->getJson(self::URL)->assertUnauthorized();
        $clerk = User::factory()->create(['company_id' => $this->apex->id]);
        $clerk->accessibleCompanies()->attach($this->apex->id, ['granted_status' => 'accepted']);
        $this->actingAs($clerk)->getJson(self::URL)->assertForbidden();
        $this->actingAs($clerk)->postJson(self::URL.'/payee_types', ['name' => 'X'])->assertForbidden();
    }
}
