<?php

namespace Tests\Feature\Api;

use App\Models\BudgetAllocation;
use App\Models\Company;
use App\Models\Department;
use App\Models\PayeeType;
use App\Models\User;
use App\Models\VoucherCategory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

/**
 * Phase 4 budgets (2026-11-27): the Accounting Officer's yearly department budgets
 * (Framer AwnFnuBYJ overview, kpJmhDxKE department, MGf9CXv2s edit allocation).
 * Allocate, edit (applied or sent for Supervisor sign-off above the Global setting), cancel a request,
 * final approval uses the budget (+ alert), and the tenancy / role / race rules.
 * Run:  php artisan test --filter=BudgetsTest
 */
class BudgetsTest extends TestCase
{
    use RefreshDatabase;

    private Company $apex;

    private Company $north;

    private User $clerk;

    private User $officer;

    private User $supervisor;

    private Department $it;

    private int $category;

    private int $payeeType;

    protected function setUp(): void
    {
        parent::setUp();
        Mail::fake();
        $this->apex = Company::factory()->create(['name' => 'Apex Holdings Inc.', 'fiscal_year_start' => null]);
        $this->north = Company::factory()->create(['name' => 'Northfield']);
        $this->clerk = User::factory()->create(['first_name' => 'Juan', 'last_name' => 'Dela Cruz', 'company_id' => $this->apex->id]);
        $this->officer = User::factory()->officer()->create(['first_name' => 'Maria', 'last_name' => 'Santos', 'company_id' => $this->apex->id]);
        $this->supervisor = User::factory()->supervisor()->create(['first_name' => 'Ana', 'last_name' => 'Reyes', 'company_id' => $this->apex->id]);
        foreach ([$this->clerk, $this->officer, $this->supervisor] as $u) {
            $u->accessibleCompanies()->attach($this->apex->id, ['granted_status' => 'accepted']);
        }
        $this->it = Department::factory()->for($this->apex)->create(['name' => 'IT & Systems', 'head_user_id' => $this->clerk->id]);
        $this->category = VoucherCategory::create(['company_id' => $this->apex->id, 'name' => 'IT equipment'])->id;
        $this->payeeType = PayeeType::create(['company_id' => $this->apex->id, 'name' => 'Supplier'])->id;
    }

    private function api(string $method, string $uri, array $data = [], ?User $as = null, ?int $company = null)
    {
        return $this->actingAs($as ?? $this->officer)->json($method, '/api/v1'.$uri, $data, ['X-Company-ID' => (string) ($company ?? $this->apex->id)]);
    }

    private function allocate(string $amount = '1000000.00', int $alert = 90): int
    {
        return $this->api('POST', '/officer/budgets', [
            'department_id' => $this->it->id, 'fiscal_year' => now()->year, 'total_budget' => $amount, 'alert_threshold_pct' => $alert,
        ])->assertCreated()->json('data.id');
    }

    /** A clerk's submitted voucher for $amount in IT. */
    private function submitted(string $amount): int
    {
        $id = $this->api('POST', '/vouchers', [
            'category_id' => $this->category, 'payment_method' => 'cash', 'payee_name' => 'Dell Philippines',
            'payee_type_id' => $this->payeeType, 'department_id' => $this->it->id, 'description' => 'Laptops',
            'line_items' => [['description' => 'Laptop', 'quantity' => '1', 'unit_price' => $amount]],
        ], $this->clerk)->assertCreated()->json('data.id');
        $this->api('POST', "/vouchers/{$id}/submit", [], $this->clerk)->assertOk();

        return $id;
    }

    public function test_allocate_and_list(): void
    {
        $id = $this->allocate('1500000', 90);

        $this->assertDatabaseHas('budget_allocations', ['id' => $id, 'fiscal_month' => null, 'total_budget' => '1500000.00', 'used_amount' => '0.00']);
        $this->assertDatabaseHas('audit_logs', ['action' => 'budget_allocated', 'table_name' => 'budget_allocations', 'record_id' => $id]);

        $this->api('GET', '/officer/budgets')->assertOk()
            ->assertJsonPath('data.fiscal_year', now()->year)
            ->assertJsonPath('data.label', 'FY '.now()->year)
            ->assertJsonPath('data.summary.total_allocated', '1500000.00')
            ->assertJsonPath('data.summary.departments', 1)
            ->assertJsonPath('data.rows.0.department.name', 'IT & Systems')
            ->assertJsonPath('data.rows.0.budget.alert_pct', 90)
            ->assertJsonPath('data.signoff_above', '250000.00');

        $this->api('GET', "/officer/budgets/departments/{$this->it->id}")->assertOk()
            ->assertJsonPath('data.department.head', 'Juan Dela Cruz')
            ->assertJsonPath('data.budget.remaining', '1500000.00')
            ->assertJsonCount(12, 'data.monthly');
    }

    public function test_allocate_validates_and_refuses_a_second_budget(): void
    {
        $this->api('POST', '/officer/budgets', ['department_id' => $this->it->id, 'fiscal_year' => now()->year, 'total_budget' => '10.555', 'alert_threshold_pct' => 30])
            ->assertStatus(422)->assertJsonValidationErrors(['total_budget', 'alert_threshold_pct']);
        $this->api('POST', '/officer/budgets', ['department_id' => $this->it->id, 'fiscal_year' => now()->year + 4, 'total_budget' => '1000', 'alert_threshold_pct' => 80])
            ->assertStatus(422)->assertJsonValidationErrors(['fiscal_year']);

        $this->allocate();
        $this->api('POST', '/officer/budgets', ['department_id' => $this->it->id, 'fiscal_year' => now()->year, 'total_budget' => '5000', 'alert_threshold_pct' => 80])
            ->assertStatus(409)->assertJsonPath('code', 'BUDGET_EXISTS');
    }

    public function test_small_edit_applies_and_big_edit_waits_for_the_supervisor(): void
    {
        $id = $this->allocate('1500000.00');
        $stamp = ['was_total' => '1500000.00', 'was_alert_pct' => 90];

        $this->api('PATCH', "/officer/budgets/{$id}", ['total_budget' => '1600000', 'alert_threshold_pct' => 85, 'reason' => 'Laptop refresh'] + $stamp)
            ->assertOk()->assertJsonPath('data.applied', true);
        $this->assertDatabaseHas('budget_allocations', ['id' => $id, 'total_budget' => '1600000.00', 'alert_threshold_pct' => '85.00', 'updated_by' => $this->officer->id]);

        // the old form is stale now
        $this->api('PATCH', "/officer/budgets/{$id}", ['total_budget' => '1700000', 'alert_threshold_pct' => 85, 'reason' => 'More laptops'] + $stamp)
            ->assertStatus(409)->assertJsonPath('code', 'BUDGET_CHANGED');

        $stamp = ['was_total' => '1600000.00', 'was_alert_pct' => 85];
        $this->api('PATCH', "/officer/budgets/{$id}", ['total_budget' => '2000000', 'alert_threshold_pct' => 85, 'reason' => 'New office floor'] + $stamp)
            ->assertStatus(202)->assertJsonPath('data.applied', false);
        $this->assertDatabaseHas('budget_allocations', ['id' => $id, 'total_budget' => '1600000.00']); // not applied
        $this->assertDatabaseHas('budget_change_requests', ['budget_allocation_id' => $id, 'requested_budget' => '2000000.00', 'status' => 'pending']);
        $this->assertDatabaseHas('notifications', ['recipient_id' => $this->supervisor->id, 'type' => 'budget_change']);

        // only one waiting request at a time
        $this->api('PATCH', "/officer/budgets/{$id}", ['total_budget' => '1610000', 'alert_threshold_pct' => 85, 'reason' => 'Small fix'] + $stamp)
            ->assertStatus(409)->assertJsonPath('code', 'BUDGET_REQUEST_PENDING');

        $request = DB::table('budget_change_requests')->value('id');
        $other = User::factory()->officer()->create(['company_id' => $this->apex->id]);
        $other->accessibleCompanies()->attach($this->apex->id, ['granted_status' => 'accepted']);
        $this->api('DELETE', "/officer/budgets/requests/{$request}", [], $other)->assertStatus(403)->assertJsonPath('code', 'NOT_YOUR_REQUEST');
        $this->api('DELETE', "/officer/budgets/requests/{$request}")->assertOk();
        $this->api('DELETE', "/officer/budgets/requests/{$request}")->assertStatus(409)->assertJsonPath('code', 'REQUEST_ALREADY_DECIDED');
        $this->assertDatabaseHas('budget_change_requests', ['id' => $request, 'status' => 'cancelled']);
    }

    public function test_edit_needs_a_reason_and_a_change(): void
    {
        $id = $this->allocate('1000000.00', 90);
        $stamp = ['was_total' => '1000000.00', 'was_alert_pct' => 90];

        $this->api('PATCH', "/officer/budgets/{$id}", ['total_budget' => '1000000', 'alert_threshold_pct' => 90] + $stamp)
            ->assertStatus(422)->assertJsonValidationErrors(['reason']);
        $this->api('PATCH', "/officer/budgets/{$id}", ['total_budget' => '1000000', 'alert_threshold_pct' => 90, 'reason' => 'No change'] + $stamp)
            ->assertStatus(409)->assertJsonPath('code', 'NOTHING_CHANGED');
    }

    public function test_final_approval_uses_the_budget_and_alerts_once(): void
    {
        $id = $this->allocate('100000.00', 80);
        $first = $this->submitted('45000.00');
        $second = $this->submitted('40000.00');

        $this->api('POST', "/officer/vouchers/{$first}/approve")->assertOk();
        $this->assertDatabaseHas('budget_allocations', ['id' => $id, 'used_amount' => '45000.00', 'alert_sent_at' => null]);

        $this->api('POST', "/officer/vouchers/{$second}/approve")->assertOk(); // 85% ≥ 80%
        $this->assertDatabaseHas('budget_allocations', ['id' => $id, 'used_amount' => '85000.00']);
        $this->assertNotNull(BudgetAllocation::find($id)->alert_sent_at);
        $this->assertSame(1, DB::table('notifications')->where('recipient_id', $this->officer->id)->where('type', 'budget_alert')->count());
        $this->assertSame(1, DB::table('notifications')->where('recipient_id', $this->clerk->id)->where('type', 'budget_alert')->count()); // the head

        $this->api('GET', '/officer/summary')->assertOk()->assertJsonPath('data.budget_alerts', 1);
        $this->api('GET', "/officer/budgets/departments/{$this->it->id}")->assertOk()
            ->assertJsonPath('data.budget.over_alert', true)
            ->assertJsonPath('data.categories.0.name', 'IT equipment');

        // raising the budget brings it under the alert again
        $this->api('PATCH', "/officer/budgets/{$id}", ['total_budget' => '150000', 'alert_threshold_pct' => 80, 'reason' => 'Top-up', 'was_total' => '100000.00', 'was_alert_pct' => 80])->assertOk();
        $this->assertNull(BudgetAllocation::find($id)->alert_sent_at);
    }

    public function test_step2_voucher_does_not_use_the_budget_yet(): void
    {
        $id = $this->allocate('1000000.00');
        $big = $this->submitted('60000.00'); // ≥ ₱50,000 → Supervisor

        $this->api('POST', "/officer/vouchers/{$big}/approve")->assertOk();
        $this->assertDatabaseHas('budget_allocations', ['id' => $id, 'used_amount' => '0.00']);
    }

    public function test_a_new_budget_counts_what_was_already_approved(): void
    {
        $v = $this->submitted('20000.00');
        $this->api('POST', "/officer/vouchers/{$v}/approve")->assertOk();

        $id = $this->allocate('100000.00');
        $this->assertDatabaseHas('budget_allocations', ['id' => $id, 'used_amount' => '20000.00']);
    }

    public function test_tenancy_and_roles(): void
    {
        $this->getJson('/api/v1/officer/budgets')->assertUnauthorized();
        $id = $this->allocate();
        $northDept = Department::factory()->for($this->north)->create();

        $this->api('GET', '/officer/budgets', [], $this->clerk)->assertForbidden();
        $this->api('GET', "/officer/budgets/departments/{$northDept->id}")->assertNotFound();
        $this->api('POST', '/officer/budgets', ['department_id' => $northDept->id, 'fiscal_year' => now()->year, 'total_budget' => '1000', 'alert_threshold_pct' => 80])
            ->assertStatus(422)->assertJsonValidationErrors(['department_id']);

        $outsider = User::factory()->officer()->create(['company_id' => $this->north->id]);
        $outsider->accessibleCompanies()->attach($this->north->id, ['granted_status' => 'accepted']);
        $this->api('PATCH', "/officer/budgets/{$id}", ['total_budget' => '1', 'alert_threshold_pct' => 80, 'reason' => 'Hacking', 'was_total' => '1', 'was_alert_pct' => 80], $outsider, $this->north->id)
            ->assertNotFound();
    }
}
