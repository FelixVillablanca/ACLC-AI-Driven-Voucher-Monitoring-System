<?php

namespace Tests\Feature\Api;

use App\Models\Company;
use App\Models\Department;
use App\Models\User;
use App\Models\VoucherCategory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * GET /api/v1/clerk/dashboard (Framer LolF6YFo5) + the ResolveCompany tenancy guard.
 * Only the clerk's own vouchers, only in the company sent in X-Company-ID.
 *
 * Run:  php artisan test --filter=ClerkDashboardTest
 */
class ClerkDashboardTest extends TestCase
{
    use RefreshDatabase;

    private const URL = '/api/v1/clerk/dashboard';

    private Company $apex;

    private Company $north;

    private User $clerk;

    private int $category;

    private int $n = 0;

    protected function setUp(): void
    {
        parent::setUp();
        $this->apex = Company::factory()->create(['name' => 'Apex']);
        $this->north = Company::factory()->create(['name' => 'Northfield']);
        $dept = Department::factory()->for($this->apex)->create(['name' => 'Finance Operations']);
        $this->clerk = User::factory()->create(['first_name' => 'Juan', 'company_id' => $this->apex->id, 'department_id' => $dept->id]);
        $this->clerk->accessibleCompanies()->attach($this->apex->id, ['granted_status' => 'accepted']);
        $this->category = VoucherCategory::create(['company_id' => $this->apex->id, 'name' => 'Utilities'])->id;
    }

    private function voucher(array $row): int
    {
        $this->n++;

        return DB::table('vouchers')->insertGetId([
            'voucher_number' => 'APX-'.$this->n, 'payment_method' => 'bank', 'category_id' => $this->category,
            'company_id' => $this->apex->id, 'created_by' => $this->clerk->id, 'payee_name' => "Payee {$this->n}",
            'amount' => '100.00', 'status' => 'draft', 'created_at' => now(), 'updated_at' => now()->addSeconds($this->n),
            ...$row,
        ]);
    }

    private function dashboard(?int $company = null)
    {
        return $this->actingAs($this->clerk)->getJson(self::URL, ['X-Company-ID' => (string) ($company ?? $this->apex->id)]);
    }

    public function test_counts_and_totals_are_the_clerks_own_vouchers_in_this_company(): void
    {
        $this->voucher(['status' => 'draft', 'amount' => '48000.00']);
        $this->voucher(['status' => 'draft', 'amount' => '250.50']);
        $this->voucher(['status' => 'pending']);
        $this->voucher(['status' => 'under_review', 'ai_anomaly_flag' => 1]);
        $this->voucher(['status' => 'approved', 'amount' => '12980.00', 'approved_at' => now()]);
        $this->voucher(['status' => 'approved', 'amount' => '999.00', 'approved_at' => now()->subMonths(2)]); // not this month
        $this->voucher(['status' => 'cancelled']);
        $this->voucher(['status' => 'pending', 'created_by' => User::factory()->create(['company_id' => $this->apex->id])->id]); // another clerk
        $this->voucher(['status' => 'pending', 'company_id' => $this->north->id]); // another company

        $this->dashboard()
            ->assertOk()
            ->assertJsonPath('data.company.name', 'Apex')
            ->assertJsonPath('data.department', 'Finance Operations')
            ->assertJsonPath('data.counts', ['all' => 6, 'drafts' => 2, 'returned' => 0, 'with_officer' => 1, 'with_supervisor' => 1])
            ->assertJsonPath('data.drafts_total', '48250.50')
            ->assertJsonPath('data.approved_this_month.count', 1)
            ->assertJsonPath('data.approved_this_month.total', '12980.00')
            ->assertJsonCount(5, 'data.recent')
            ->assertJsonPath('data.recent.1.ai_flagged', false)
            ->assertJsonPath('data.needs_attention', []);
    }

    public function test_drafts_have_no_number_yet_and_returned_vouchers_carry_the_reviewers_note(): void
    {
        $officer = User::factory()->officer()->create(['first_name' => 'Maria', 'last_name' => 'Santos', 'company_id' => $this->apex->id]);
        $this->voucher(['status' => 'draft']);
        $returned = $this->voucher(['status' => 'returned', 'voucher_number' => 'APX-2026-0418']);
        DB::table('voucher_approvals')->insert([
            ['voucher_id' => $returned, 'approver_id' => $officer->id, 'step' => 1, 'role_at_time' => 'accounting_officer', 'action' => 'returned', 'remarks' => 'Old note', 'created_at' => now()->subDay()],
            ['voucher_id' => $returned, 'approver_id' => $officer->id, 'step' => 1, 'role_at_time' => 'accounting_officer', 'action' => 'returned', 'remarks' => 'Please attach the official receipt for line 2.', 'created_at' => now()],
        ]);

        $this->dashboard()
            ->assertOk()
            ->assertJsonPath('data.counts.returned', 1)
            ->assertJsonPath('data.recent.0.status', 'returned')
            ->assertJsonPath('data.recent.1.voucher_number', null) // the draft
            ->assertJsonPath('data.needs_attention.0.voucher_number', 'APX-2026-0418')
            ->assertJsonPath('data.needs_attention.0.returned_by', 'Maria Santos')
            ->assertJsonPath('data.needs_attention.0.returned_by_role', 'accounting_officer')
            ->assertJsonPath('data.needs_attention.0.remarks', 'Please attach the official receipt for line 2.');
    }

    public function test_a_new_clerk_gets_zeros_not_an_error(): void
    {
        $this->dashboard()
            ->assertOk()
            ->assertJsonPath('data.counts.all', 0)
            ->assertJsonPath('data.drafts_total', '0.00')
            ->assertJsonPath('data.recent', []);
    }

    public function test_company_header_is_required_and_checked(): void
    {
        $this->actingAs($this->clerk)->getJson(self::URL)->assertStatus(400)->assertJsonPath('code', 'COMPANY_REQUIRED');
        $this->actingAs($this->clerk)->getJson(self::URL, ['X-Company-ID' => 'abc'])->assertStatus(400);
        $this->dashboard($this->north->id)->assertForbidden()->assertJsonPath('code', 'COMPANY_ACCESS_DENIED');

        // pending access isn't access
        $this->clerk->accessibleCompanies()->attach($this->north->id, ['granted_status' => 'pending']);
        $this->dashboard($this->north->id)->assertForbidden()->assertJsonPath('code', 'COMPANY_ACCESS_DENIED');
    }

    public function test_guests_are_401_and_other_roles_403(): void
    {
        $this->getJson(self::URL, ['X-Company-ID' => (string) $this->apex->id])->assertUnauthorized();

        $officer = User::factory()->officer()->create(['company_id' => $this->apex->id]);
        $officer->accessibleCompanies()->attach($this->apex->id, ['granted_status' => 'accepted']);
        $this->actingAs($officer)->getJson(self::URL, ['X-Company-ID' => (string) $this->apex->id])->assertForbidden();

        $admin = User::factory()->admin()->create(['company_id' => $this->apex->id]);
        $this->actingAs($admin)->getJson(self::URL, ['X-Company-ID' => (string) $this->apex->id])->assertForbidden();
    }
}
