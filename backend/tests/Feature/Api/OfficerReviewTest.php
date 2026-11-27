<?php

namespace Tests\Feature\Api;

use App\Mail\VoucherDecisionMail;
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
 * Phase 4, step 1 (2026-11-26): the Accounting Officer's review queue and decisions.
 * Approve (final, or forwarded to the Supervisor by the Global rules), return (needs-changes tags + remarks),
 * reject (reason + remarks), bulk approve, "Reviewed by me", PDF, and the tenancy / role / race rules.
 * Run:  php artisan test --filter=OfficerReviewTest
 */
class OfficerReviewTest extends TestCase
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
        $this->apex = Company::factory()->create(['name' => 'Apex Holdings Inc.']);
        $this->north = Company::factory()->create(['name' => 'Northfield']);
        $this->dept = Department::factory()->for($this->apex)->create(['name' => 'Finance Ops'])->id;
        $this->clerk = User::factory()->create(['first_name' => 'Juan', 'last_name' => 'Dela Cruz', 'company_id' => $this->apex->id, 'personal_email' => 'juan@gmail.test']);
        $this->officer = User::factory()->officer()->create(['first_name' => 'Maria', 'last_name' => 'Santos', 'company_id' => $this->apex->id]);
        $this->supervisor = User::factory()->supervisor()->create(['first_name' => 'Ana', 'last_name' => 'Reyes', 'company_id' => $this->apex->id]);
        foreach ([$this->clerk, $this->officer, $this->supervisor] as $u) {
            $u->accessibleCompanies()->attach($this->apex->id, ['granted_status' => 'accepted']);
        }
        $this->category = VoucherCategory::create(['company_id' => $this->apex->id, 'name' => 'Transportation'])->id;
        $this->payeeType = PayeeType::create(['company_id' => $this->apex->id, 'name' => 'Supplier'])->id;
    }

    private function api(string $method, string $uri, array $data = [], ?User $as = null, ?int $company = null)
    {
        return $this->actingAs($as ?? $this->officer)->json($method, '/api/v1'.$uri, $data, ['X-Company-ID' => (string) ($company ?? $this->apex->id)]);
    }

    /** A clerk's submitted voucher for $amount (one line). */
    private function submitted(string $amount, array $extra = []): int
    {
        $id = $this->api('POST', '/vouchers', array_merge([
            'category_id' => $this->category, 'payment_method' => 'cash', 'payee_name' => 'Grab for Business',
            'payee_type_id' => $this->payeeType, 'department_id' => $this->dept, 'description' => 'Rides',
            'line_items' => [['description' => 'Trips', 'quantity' => '1', 'unit_price' => $amount]],
        ], $extra), $this->clerk)->assertCreated()->json('data.id');
        $this->api('POST', "/vouchers/{$id}/submit", [], $this->clerk)->assertOk();

        return $id;
    }

    public function test_queue_lists_waiting_vouchers_with_tabs(): void
    {
        $small = $this->submitted('7840.00');
        $big = $this->submitted('142500.00');
        DB::table('vouchers')->where('id', $small)->update(['ai_anomaly_flag' => 1, 'ai_anomaly_score' => 0.71, 'submitted_at' => now()->subHours(40)]);

        $this->api('GET', '/officer/queue')->assertOk()
            ->assertJsonPath('data.0.id', $small) // oldest first
            ->assertJsonPath('data.0.ai.flagged', true)
            ->assertJsonPath('data.0.sla', 'near') // 40 h of 48
            ->assertJsonPath('data.0.clerk.short', 'Juan D.')
            ->assertJsonPath('data.1.high_value', true)
            ->assertJsonPath('meta.counts.all', 2)
            ->assertJsonPath('meta.counts.ai_flagged', 1)
            ->assertJsonPath('meta.counts.high_value', 1)
            ->assertJsonPath('meta.counts.near_sla', 1)
            ->assertJsonPath('meta.total_amount', '150340.00');

        $this->api('GET', '/officer/queue?filter[view]=high_value')->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $big);
        $this->api('GET', '/officer/queue?search=juan')->assertJsonCount(2, 'data');
        $this->api('GET', '/officer/queue?sort=amount_desc')->assertJsonPath('data.0.id', $big);
        $this->api('GET', '/officer/queue/next')->assertJsonPath('data.id', $small);
        $this->api('GET', '/officer/summary')->assertOk()->assertJsonPath('data.queue.total', 2)->assertJsonPath('data.sla_hours', 48);
        $this->api('GET', '/officer/queue?filter[amount_min]=10&filter[amount_max]=5')->assertStatus(422);
    }

    public function test_approve_is_final_below_the_threshold_and_forwarded_above_it(): void
    {
        $small = $this->submitted('9999.00');
        $big = $this->submitted('142500.00');

        $this->api('GET', "/officer/vouchers/{$big}")->assertOk()
            ->assertJsonPath('data.review.can_act', true)
            ->assertJsonPath('data.review.step2_reasons', ['high_value'])
            ->assertJsonPath('data.review.supervisors', ['Ana Reyes'])
            ->assertJsonPath('data.review.position.total', 2)
            ->assertJsonPath('data.clerk.name', 'Juan Dela Cruz');

        $this->api('POST', "/officer/vouchers/{$small}/approve")->assertOk()
            ->assertJsonPath('data.status', 'approved')->assertJsonPath('data.forwarded', false)->assertJsonPath('data.next_id', $big);
        $this->assertNotNull(DB::table('vouchers')->where('id', $small)->value('approved_at'));
        $this->assertDatabaseHas('notifications', ['recipient_id' => $this->clerk->id, 'type' => 'voucher_approved', 'voucher_id' => $small]);

        $this->api('POST', "/officer/vouchers/{$big}/approve", ['remarks' => 'Checked the quotation.'])->assertOk()
            ->assertJsonPath('data.status', 'under_review')->assertJsonPath('data.forwarded', true)->assertJsonPath('data.supervisors', ['Ana Reyes']);
        $this->assertDatabaseHas('notifications', ['recipient_id' => $this->supervisor->id, 'type' => 'voucher_pending', 'voucher_id' => $big]);
        $this->assertDatabaseHas('voucher_approvals', ['voucher_id' => $big, 'approver_id' => $this->officer->id, 'step' => 1, 'action' => 'approved', 'remarks' => 'Checked the quotation.']);
        $this->assertDatabaseHas('audit_logs', ['action' => 'voucher_approved', 'record_id' => $big]);

        // a second decision on the same voucher (another officer was faster)
        $this->api('POST', "/officer/vouchers/{$big}/reject", ['reason' => 'other', 'remarks' => 'Too late now'])
            ->assertStatus(409)->assertJsonPath('code', 'VOUCHER_ALREADY_REVIEWED');

        // the clerk sees it with the Supervisor, and the history
        $this->api('GET', "/vouchers/{$big}", [], $this->clerk)->assertJsonPath('data.status', 'under_review')->assertJsonPath('data.history.0.action', 'approved');
    }

    public function test_return_with_tags_and_the_clerk_sees_them(): void
    {
        $id = $this->submitted('7840.00');

        $this->api('POST', "/officer/vouchers/{$id}/return", ['needs_changes' => [], 'remarks' => ''])->assertStatus(422)
            ->assertJsonValidationErrors(['needs_changes', 'remarks']);
        $this->api('POST', "/officer/vouchers/{$id}/return", ['needs_changes' => ['nope'], 'remarks' => 'Fix the lines please'])->assertStatus(422);

        $this->api('POST', "/officer/vouchers/{$id}/return", ['needs_changes' => ['line_items', 'amount'], 'remarks' => 'Split the airport transfer into its own line.'])
            ->assertOk()->assertJsonPath('data.status', 'returned');

        $this->assertDatabaseHas('notifications', ['recipient_id' => $this->clerk->id, 'type' => 'voucher_returned', 'voucher_id' => $id]);
        Mail::assertSent(VoucherDecisionMail::class, fn ($m) => $m->hasTo('juan@gmail.test') && $m->decision === 'returned' && $m->needsChanges === ['Line items', 'Amount']);

        // Returned to me shows who, the tags and the note; resubmitting puts it back in the queue as "resubmitted"
        $this->api('GET', '/vouchers?filter[view]=returned', [], $this->clerk)
            ->assertJsonPath('data.0.returned.by', 'Maria Santos')
            ->assertJsonPath('data.0.returned.needs_changes', ['Line items', 'Amount']);
        $this->api('POST', "/vouchers/{$id}/submit", [], $this->clerk)->assertOk();
        $this->api('GET', '/officer/queue?filter[view]=resubmitted')->assertJsonCount(1, 'data')->assertJsonPath('data.0.resubmitted', true);
    }

    public function test_reject_needs_a_reason_and_remarks(): void
    {
        $id = $this->submitted('7840.00');

        $this->api('POST', "/officer/vouchers/{$id}/reject", ['reason' => 'duplicate'])->assertStatus(422)->assertJsonValidationErrors('remarks');
        $this->api('POST', "/officer/vouchers/{$id}/reject", ['reason' => 'duplicate', 'remarks' => 'Same bill as APX-2026-0391.'])
            ->assertOk()->assertJsonPath('data.status', 'rejected');

        $this->assertDatabaseHas('voucher_approvals', ['voucher_id' => $id, 'action' => 'rejected', 'reason' => 'duplicate']);
        Mail::assertSent(VoucherDecisionMail::class, fn ($m) => $m->decision === 'rejected' && $m->reason === 'Duplicate of another voucher');
        // closed: the clerk can't resubmit
        $this->api('POST', "/vouchers/{$id}/submit", [], $this->clerk)->assertStatus(409);
    }

    public function test_bulk_approve_all_or_nothing_and_never_ai_flagged(): void
    {
        $a = $this->submitted('100.00');
        $b = $this->submitted('200.00');
        $flagged = $this->submitted('300.00');
        DB::table('vouchers')->where('id', $flagged)->update(['ai_anomaly_flag' => 1]);

        $this->api('POST', '/officer/vouchers/bulk-approve', ['ids' => [$a, $flagged]])->assertStatus(409)->assertJsonPath('code', 'BULK_NOT_ALLOWED');
        $this->assertSame('pending', DB::table('vouchers')->where('id', $a)->value('status')); // nothing happened

        $this->api('POST', '/officer/vouchers/bulk-approve', ['ids' => [$a, $b]])->assertOk()->assertJsonPath('data.approved', 2);
        $this->assertSame(2, DB::table('vouchers')->whereIn('id', [$a, $b])->where('status', 'approved')->count());

        $this->api('GET', '/officer/reviews')->assertOk()->assertJsonPath('meta.total', 2)->assertJsonPath('meta.today.approved', 2);
        $this->api('GET', '/officer/reviews?filter[action]=returned')->assertJsonPath('meta.total', 0);
    }

    public function test_similar_vouchers_budget_and_pdf(): void
    {
        $old = $this->submitted('7520.00');
        $this->api('POST', "/officer/vouchers/{$old}/approve")->assertOk();
        $new = $this->submitted('7840.00');
        DB::table('budget_allocations')->insert([
            'company_id' => $this->apex->id, 'department_id' => $this->dept, 'fiscal_year' => now()->year, // yearly budgets (2026-11-27)
            'total_budget' => '100000.00', 'used_amount' => '59000.00', 'alert_threshold_pct' => 80, 'created_at' => now(), 'updated_at' => now(),
        ]);

        $this->api('GET', "/officer/vouchers/{$new}")->assertOk()
            ->assertJsonPath('data.review.similar.0.id', $old)
            ->assertJsonPath('data.review.budget.used_pct', 59)
            ->assertJsonPath('data.review.budget.after_pct', 66.8);

        $this->api('GET', "/officer/vouchers/{$new}/pdf")->assertOk()->assertHeader('Content-Type', 'application/pdf');
        $this->api('GET', "/vouchers/{$new}/pdf", [], $this->clerk)->assertOk()->assertHeader('Content-Type', 'application/pdf');
    }

    public function test_dashboard_numbers_are_real(): void
    {
        $old = $this->submitted('1000.00');
        DB::table('vouchers')->where('id', $old)->update(['submitted_at' => now()->subHours(30)]);
        $flagged = $this->submitted('2000.00', ['payee_name' => 'Meralco']);
        DB::table('vouchers')->where('id', $flagged)->update(['ai_anomaly_flag' => 1, 'ai_anomaly_score' => 0.71]);
        $done = $this->submitted('500.00', ['payee_name' => 'PLDT']);
        $this->travel(2)->hours();
        $this->api('POST', "/officer/vouchers/{$done}/approve")->assertOk();
        DB::table('budget_allocations')->insert([
            'company_id' => $this->apex->id, 'department_id' => $this->dept, 'fiscal_year' => now()->year, // yearly budgets (2026-11-27)
            'total_budget' => '10000.00', 'used_amount' => '9200.00', 'alert_threshold_pct' => 90, 'created_at' => now(), 'updated_at' => now(),
        ]);

        $this->api('GET', '/officer/dashboard')->assertOk()
            ->assertJsonPath('data.company', 'Apex Holdings Inc.')
            ->assertJsonPath('data.queue.total', 2)
            ->assertJsonPath('data.queue.older_than_24h', 1)
            ->assertJsonPath('data.queue.flagged', 1)
            ->assertJsonPath('data.top.0.id', $flagged) // flagged first
            ->assertJsonPath('data.top.1.id', $old)
            ->assertJsonPath('data.mine.approved', 1)
            ->assertJsonPath('data.mine.approved_amount', '500.00')
            ->assertJsonPath('data.review_time.avg_hours', 2)
            ->assertJsonPath('data.budgets.rows.0.used_pct', 92)
            ->assertJsonPath('data.budgets.label', 'FY '.now()->year)
            ->assertJsonPath('data.spend.approved_amount', '500.00');

        $this->api('GET', '/officer/dashboard', [], $this->clerk)->assertForbidden();
    }

    public function test_tenancy_roles_and_drafts_stay_private(): void
    {
        $id = $this->submitted('500.00');
        $draft = $this->api('POST', '/vouchers', ['category_id' => $this->category, 'payment_method' => 'cash', 'line_items' => []], $this->clerk)->json('data.id');

        $this->api('GET', "/officer/vouchers/{$draft}")->assertNotFound(); // a draft is the clerk's own business

        $northOfficer = User::factory()->officer()->create(['company_id' => $this->north->id]);
        $northOfficer->accessibleCompanies()->attach($this->north->id, ['granted_status' => 'accepted']);
        $this->api('GET', "/officer/vouchers/{$id}", [], $northOfficer, $this->north->id)->assertNotFound();
        $this->api('POST', "/officer/vouchers/{$id}/approve", [], $northOfficer, $this->north->id)->assertNotFound();
        $this->api('GET', '/officer/queue', [], $northOfficer)->assertForbidden(); // no access to Apex

        $this->api('GET', '/officer/queue', [], $this->clerk)->assertForbidden();
        $this->api('POST', "/officer/vouchers/{$id}/approve", [], $this->supervisor)->assertForbidden();

        auth()->forgetGuards();
        $this->json('GET', '/api/v1/officer/queue', [], ['X-Company-ID' => (string) $this->apex->id])->assertUnauthorized();
    }

    public function test_nobody_reviews_their_own_voucher(): void
    {
        $id = $this->submitted('500.00');
        DB::table('vouchers')->where('id', $id)->update(['created_by' => $this->officer->id]);

        $this->api('GET', "/officer/vouchers/{$id}")->assertJsonPath('data.review.can_act', false)->assertJsonPath('data.review.own_voucher', true);
        $this->api('POST', "/officer/vouchers/{$id}/approve")->assertStatus(403)->assertJsonPath('code', 'SELF_REVIEW');
    }
}
