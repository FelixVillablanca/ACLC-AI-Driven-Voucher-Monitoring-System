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
 * Phase 4, Level 2 (2026-11-27): the Supervisor / Manager's final approval
 * (Framer RRXP4iCfd queue, Nl0dfYkY_ review, WQL6Ca1ML approve, PlbU6CVEj return, tW_30cpOE reject, WAk4RKdFc cleared).
 * Run:  php artisan test --filter=SupervisorReviewTest
 */
class SupervisorReviewTest extends TestCase
{
    use RefreshDatabase;

    private Company $apex;

    private Company $north;

    private User $clerk;

    private User $officer;

    private User $supervisor;

    private int $category;

    private int $payeeType;

    private int $dept;

    protected function setUp(): void
    {
        parent::setUp();
        Mail::fake();
        $this->apex = Company::factory()->create(['name' => 'Apex Holdings Inc.', 'fiscal_year_start' => null]);
        $this->north = Company::factory()->create(['name' => 'Northfield']);
        $this->dept = Department::factory()->for($this->apex)->create(['name' => 'IT & Systems'])->id;
        $this->clerk = User::factory()->create(['first_name' => 'Ana', 'last_name' => 'Reyes', 'company_id' => $this->apex->id]);
        $this->officer = User::factory()->officer()->create(['first_name' => 'Maria', 'last_name' => 'Santos', 'company_id' => $this->apex->id]);
        $this->supervisor = User::factory()->supervisor()->create(['first_name' => 'Ramon', 'last_name' => 'Dela Cruz', 'company_id' => $this->apex->id]);
        foreach ([$this->clerk, $this->officer, $this->supervisor] as $u) {
            $u->accessibleCompanies()->attach($this->apex->id, ['granted_status' => 'accepted']);
        }
        $this->category = VoucherCategory::create(['company_id' => $this->apex->id, 'name' => 'Equipment'])->id;
        $this->payeeType = PayeeType::create(['company_id' => $this->apex->id, 'name' => 'Supplier'])->id;
    }

    private function api(string $method, string $uri, array $data = [], ?User $as = null, ?int $company = null)
    {
        return $this->actingAs($as ?? $this->supervisor)->json($method, '/api/v1'.$uri, $data, ['X-Company-ID' => (string) ($company ?? $this->apex->id)]);
    }

    /** Submitted by the clerk and approved by the officer: ≥ ₱50,000 goes to the Supervisor. */
    private function atLevel2(string $amount = '186600.00', bool $flagged = false): int
    {
        $id = $this->api('POST', '/vouchers', [
            'category_id' => $this->category, 'payment_method' => 'cash', 'payee_name' => 'TechZone Trading',
            'payee_type_id' => $this->payeeType, 'department_id' => $this->dept, 'description' => 'Laptops',
            'line_items' => [['description' => 'Laptop', 'quantity' => '1', 'unit_price' => $amount]],
        ], $this->clerk)->assertCreated()->json('data.id');
        $this->api('POST', "/vouchers/{$id}/submit", [], $this->clerk)->assertOk();
        if ($flagged) {
            DB::table('vouchers')->where('id', $id)->update(['ai_anomaly_flag' => 1, 'ai_anomaly_score' => 0.91, 'ai_anomaly_reason' => 'Amount far above normal']);
        }
        $this->api('POST', "/officer/vouchers/{$id}/approve", ['remarks' => 'Quotation checked.'], $this->officer)->assertOk()->assertJsonPath('data.forwarded', true);

        return $id;
    }

    public function test_queue_and_review_page(): void
    {
        $id = $this->atLevel2('186600.00', flagged: true);
        $small = $this->atLevel2('60000.00');

        $this->api('GET', '/supervisor/queue')->assertOk()
            ->assertJsonPath('meta.counts.all', 2)
            ->assertJsonPath('meta.counts.ai_flagged', 1)
            ->assertJsonPath('meta.counts.high_value', 2)
            ->assertJsonPath('data.0.level1.by', 'Maria Santos')
            ->assertJsonPath('data.0.level1.remarks', 'Quotation checked.');

        $this->api('GET', "/supervisor/vouchers/{$id}")->assertOk()
            ->assertJsonPath('data.status', 'under_review')
            ->assertJsonPath('data.review.can_act', true)
            ->assertJsonPath('data.review.level1.by', 'Maria Santos')
            ->assertJsonPath('data.ai.flagged', true);

        $this->api('GET', '/supervisor/summary')->assertOk()->assertJsonPath('data.queue.total', 2)->assertJsonPath('data.queue.ai_flagged', 1);
        $this->assertNotNull($small);
    }

    public function test_final_approval_uses_the_budget_and_needs_remarks_when_flagged(): void
    {
        $budget = BudgetAllocation::create(['company_id' => $this->apex->id, 'department_id' => $this->dept, 'fiscal_year' => now()->year,
            'total_budget' => '1000000.00', 'used_amount' => '0.00', 'alert_threshold_pct' => 90]);
        $id = $this->atLevel2('186600.00', flagged: true);

        $this->api('POST', "/supervisor/vouchers/{$id}/approve")->assertStatus(422)->assertJsonValidationErrors(['remarks']);
        $this->api('POST', "/supervisor/vouchers/{$id}/approve", ['remarks' => 'Replaces 6 laptops past warranty.'])->assertOk()
            ->assertJsonPath('data.status', 'approved');

        $this->assertDatabaseHas('vouchers', ['id' => $id, 'status' => 'approved']);
        $this->assertNotNull(DB::table('vouchers')->where('id', $id)->value('approved_at'));
        $this->assertDatabaseHas('voucher_approvals', ['voucher_id' => $id, 'step' => 2, 'action' => 'approved', 'approver_id' => $this->supervisor->id]);
        $this->assertSame('186600.00', (string) $budget->fresh()->used_amount);
        $this->assertDatabaseHas('notifications', ['recipient_id' => $this->clerk->id, 'type' => 'voucher_approved', 'title' => DB::table('vouchers')->where('id', $id)->value('voucher_number').' was approved']);
        $this->assertDatabaseHas('notifications', ['recipient_id' => $this->officer->id, 'type' => 'voucher_approved']);

        $this->api('POST', "/supervisor/vouchers/{$id}/approve", ['remarks' => 'Again'])->assertStatus(409)->assertJsonPath('code', 'VOUCHER_ALREADY_REVIEWED');
        $this->api('GET', '/supervisor/reviews')->assertOk()->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.step', 2);
    }

    public function test_return_to_clerk_and_to_accounting(): void
    {
        $toClerk = $this->atLevel2();
        $toAccounting = $this->atLevel2('75000.00');

        $this->api('POST', "/supervisor/vouchers/{$toClerk}/return", ['needs_changes' => ['amount'], 'remarks' => 'Attach a second quotation.'])
            ->assertStatus(422)->assertJsonValidationErrors(['send_to']);
        $this->api('POST', "/supervisor/vouchers/{$toClerk}/return", ['send_to' => 'clerk', 'needs_changes' => ['amount'], 'remarks' => 'Attach a second quotation.'])
            ->assertOk()->assertJsonPath('data.status', 'returned');
        $this->assertDatabaseHas('notifications', ['recipient_id' => $this->clerk->id, 'type' => 'voucher_returned']);
        $this->api('GET', "/vouchers/{$toClerk}", [], $this->clerk)->assertOk()
            ->assertJsonPath('data.returned.step', 2)->assertJsonPath('data.returned.role', 'supervisor_manager');

        $this->api('POST', "/supervisor/vouchers/{$toAccounting}/return", ['send_to' => 'accounting', 'needs_changes' => ['category'], 'remarks' => 'Wrong category, please check.'])
            ->assertOk()->assertJsonPath('data.status', 'pending');
        $this->assertDatabaseHas('notifications', ['recipient_id' => $this->officer->id, 'type' => 'voucher_returned']);
        $this->api('GET', "/officer/vouchers/{$toAccounting}", [], $this->officer)->assertOk()
            ->assertJsonPath('data.review.can_act', true)
            ->assertJsonPath('data.review.supervisor_return.by', 'Ramon Dela Cruz')
            ->assertJsonPath('data.review.supervisor_return.needs_changes.0', 'Category');
    }

    public function test_reject_and_bulk(): void
    {
        $a = $this->atLevel2('60000.00');
        $b = $this->atLevel2('70000.00');
        $flagged = $this->atLevel2('80000.00', flagged: true);

        $this->api('POST', "/supervisor/vouchers/{$a}/reject", ['remarks' => 'No budget.'])->assertStatus(422)->assertJsonValidationErrors(['reason']);
        $this->api('POST', "/supervisor/vouchers/{$a}/reject", ['reason' => 'no_budget', 'remarks' => 'IT budget is exhausted for this year.'])
            ->assertOk()->assertJsonPath('data.status', 'rejected');
        $this->assertDatabaseHas('notifications', ['recipient_id' => $this->clerk->id, 'type' => 'voucher_rejected']);

        $this->api('POST', '/supervisor/vouchers/bulk-approve', ['ids' => [$b, $flagged]])->assertStatus(409)->assertJsonPath('code', 'BULK_NOT_ALLOWED');
        $this->api('POST', '/supervisor/vouchers/bulk-approve', ['ids' => [$b]])->assertOk()->assertJsonPath('data.approved', 1);
        $this->assertDatabaseHas('vouchers', ['id' => $b, 'status' => 'approved']);
    }

    public function test_tenancy_roles_and_own_voucher(): void
    {
        $this->getJson('/api/v1/supervisor/queue')->assertUnauthorized();
        $id = $this->atLevel2();

        $this->api('GET', '/supervisor/queue', [], $this->officer)->assertForbidden();

        $outsider = User::factory()->supervisor()->create(['company_id' => $this->north->id]);
        $outsider->accessibleCompanies()->attach($this->north->id, ['granted_status' => 'accepted']);
        $this->api('GET', "/supervisor/vouchers/{$id}", [], $outsider, $this->north->id)->assertNotFound();
        $this->api('POST', "/supervisor/vouchers/{$id}/approve", ['remarks' => 'x'], $outsider, $this->north->id)->assertNotFound();

        DB::table('vouchers')->where('id', $id)->update(['created_by' => $this->supervisor->id]);
        $this->api('POST', "/supervisor/vouchers/{$id}/approve")->assertStatus(403)->assertJsonPath('code', 'SELF_REVIEW');
    }

    public function test_dashboard_numbers_are_real(): void
    {
        BudgetAllocation::create(['company_id' => $this->apex->id, 'department_id' => $this->dept, 'fiscal_year' => now()->year,
            'total_budget' => '300000.00', 'used_amount' => '200000.00', 'alert_threshold_pct' => 90]);
        $flagged = $this->atLevel2('80000.00', flagged: true);
        $normal = $this->atLevel2('60000.00');
        $done = $this->atLevel2('55000.00');
        // same payee + similar amounts: the automatic check may flag them as duplicates; keep only one flagged
        DB::table('vouchers')->whereIn('id', [$normal, $done])->update(['ai_anomaly_flag' => 0]);
        $this->api('POST', "/supervisor/vouchers/{$done}/approve")->assertOk();

        $this->api('GET', '/supervisor/dashboard')->assertOk()
            ->assertJsonPath('data.queue.total', 2)
            ->assertJsonPath('data.queue.total_amount', '140000.00')
            ->assertJsonPath('data.queue.flagged', 1)
            ->assertJsonPath('data.queue.oldest_days', 0)
            ->assertJsonPath('data.released.count', 1)
            ->assertJsonPath('data.released.amount', '55000.00')
            ->assertJsonPath('data.budget.used_pct', 85) // 255,000 of 300,000
            ->assertJsonPath('data.top.0.id', $flagged)
            ->assertJsonPath('data.pipeline.level2', 2)
            ->assertJsonPath('data.alert.department', 'IT & Systems')
            ->assertJsonPath('data.alert.after_pct', 131); // (255,000 + 140,000) / 300,000

        $this->api('GET', '/supervisor/dashboard', [], $this->officer)->assertForbidden();
    }

    /** Framer ESBUdF0jl (list) + lFqUUsfzi (investigate), 2026-11-27. */
    public function test_flagged_list_stats_and_investigation(): void
    {
        $this->getJson('/api/v1/supervisor/flagged')->assertUnauthorized();
        $high = $this->atLevel2('90000.00', flagged: true);
        $low = $this->atLevel2('60000.00', flagged: true);
        $plain = $this->atLevel2('70000.00');
        $done = $this->atLevel2('55000.00', flagged: true);
        DB::table('vouchers')->where('id', $plain)->update(['ai_anomaly_flag' => 0]);
        DB::table('vouchers')->where('id', $low)->update(['ai_anomaly_score' => 0.72]);
        DB::table('vouchers')->whereIn('id', [$high, $low, $done])->update(['ai_checked_at' => now()]);
        $this->api('POST', "/supervisor/vouchers/{$done}/reject", ['reason' => 'no_budget', 'remarks' => 'Over the IT budget.'])->assertOk();

        $this->api('GET', '/supervisor/flagged')->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.id', $high) // highest score first
            ->assertJsonPath('data.0.level1.by', 'Maria Santos')
            ->assertJsonPath('data.1.id', $low)
            ->assertJsonPath('meta.stats.open', 2)
            ->assertJsonPath('meta.stats.on_hold', '150000.00')
            ->assertJsonPath('meta.stats.decided.rejected', 1)
            ->assertJsonPath('meta.stats.accuracy.ended', 1)
            ->assertJsonPath('meta.stats.accuracy.pct', 100);
        $this->api('GET', '/supervisor/flagged', ['sort' => 'amount_desc'])->assertOk()->assertJsonPath('data.0.id', $high);
        $this->api('GET', '/supervisor/flagged', ['sort' => 'nope'])->assertStatus(422);

        $this->api('GET', "/supervisor/vouchers/{$high}/investigation")->assertOk()
            ->assertJsonPath('data.flagged', true)
            ->assertJsonPath('data.department', 'IT & Systems')
            ->assertJsonCount(3, 'data.past_payments'); // the other three vouchers to TechZone Trading

        $this->api('GET', '/supervisor/flagged', [], $this->officer)->assertForbidden();
        $outsider = User::factory()->supervisor()->create(['company_id' => $this->north->id]);
        $outsider->accessibleCompanies()->attach($this->north->id, ['granted_status' => 'accepted']);
        $this->api('GET', "/supervisor/vouchers/{$high}/investigation", [], $outsider, $this->north->id)->assertNotFound();
        $this->api('GET', '/supervisor/flagged', [], $outsider, $this->north->id)->assertOk()->assertJsonCount(0, 'data');
    }
}
