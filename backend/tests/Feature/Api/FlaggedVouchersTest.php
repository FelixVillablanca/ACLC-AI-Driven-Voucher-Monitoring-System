<?php

namespace Tests\Feature\Api;

use App\Domain\Platform\SystemSettings;
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
 * Flagged vouchers (2026-11-27, Framer dtNDyUAUp / YX1IiDXMp): the rule-based automatic check that runs after
 * Submit (queue is `sync` in tests, so it runs at once), the officer's list / stats / investigation, and the
 * findings: valid but high (approve), needs changes (return), false alarm (flag cleared).
 * Run:  php artisan test --filter=FlaggedVouchersTest
 */
class FlaggedVouchersTest extends TestCase
{
    use RefreshDatabase;

    private Company $apex;

    private User $clerk;

    private User $officer;

    private int $it;

    private int $fuel;

    private int $payeeType;

    private int $dept;

    protected function setUp(): void
    {
        parent::setUp();
        Mail::fake();
        $this->apex = Company::factory()->create(['name' => 'Apex Holdings Inc.']);
        $this->dept = Department::factory()->for($this->apex)->create(['name' => 'IT & Systems'])->id;
        $this->clerk = User::factory()->create(['first_name' => 'Liza', 'last_name' => 'Mendoza', 'company_id' => $this->apex->id]);
        $this->officer = User::factory()->officer()->create(['first_name' => 'Maria', 'last_name' => 'Santos', 'company_id' => $this->apex->id]);
        foreach ([$this->clerk, $this->officer] as $u) {
            $u->accessibleCompanies()->attach($this->apex->id, ['granted_status' => 'accepted']);
        }
        $this->it = VoucherCategory::create(['company_id' => $this->apex->id, 'name' => 'IT equipment'])->id;
        $this->fuel = VoucherCategory::create(['company_id' => $this->apex->id, 'name' => 'Fuel'])->id;
        $this->payeeType = PayeeType::create(['company_id' => $this->apex->id, 'name' => 'Supplier'])->id;
    }

    private function api(string $method, string $uri, array $data = [], ?User $as = null)
    {
        return $this->actingAs($as ?? $this->officer)->json($method, '/api/v1'.$uri, $data, ['X-Company-ID' => (string) $this->apex->id]);
    }

    private function submit(string $amount, string $payee = 'Lazada Business', ?int $category = null): int
    {
        $id = $this->api('POST', '/vouchers', [
            'category_id' => $category ?? $this->it, 'payment_method' => 'cash', 'payee_name' => $payee, 'payee_type_id' => $this->payeeType,
            'department_id' => $this->dept, 'description' => 'Purchase',
            'line_items' => [['description' => 'Item', 'quantity' => '1', 'unit_price' => $amount]],
        ], $this->clerk)->assertCreated()->json('data.id');
        $this->api('POST', "/vouchers/{$id}/submit", [], $this->clerk)->assertOk();

        return $id;
    }

    /** Approved vouchers in earlier months (the history the amount check compares with). */
    private function history(array $monthsAgoToAmount, string $payee = 'Other Supplier', ?int $category = null): void
    {
        foreach ($monthsAgoToAmount as $ago => $amount) {
            $at = now()->startOfMonth()->subMonths($ago)->addDays(3);
            DB::table('vouchers')->insert([
                'voucher_number' => 'OLD-'.$ago.'-'.$amount, 'company_id' => $this->apex->id, 'department_id' => $this->dept,
                'created_by' => $this->clerk->id, 'payee_name' => $payee, 'payment_method' => 'cash', 'category_id' => $category ?? $this->it,
                'amount' => $amount, 'status' => 'approved', 'submitted_at' => $at, 'approved_at' => $at, 'created_at' => $at, 'updated_at' => $at,
            ]);
        }
    }

    private function sensitivity(string $level): void
    {
        DB::table('system_settings')->updateOrInsert(['key' => SystemSettings::ANOMALY_SENSITIVITY], ['value' => json_encode($level), 'group' => 'ai']);
    }

    public function test_an_unusual_amount_is_flagged_after_submit_and_the_officers_are_told(): void
    {
        $this->history([1 => '38000.00', 2 => '42000.00', 3 => '35000.00', 4 => '46000.00']);
        $id = $this->submit('98450.00');

        $v = DB::table('vouchers')->find($id);
        $this->assertSame(1, (int) $v->ai_anomaly_flag);
        $this->assertSame('rules', $v->ai_check_source);
        $this->assertStringContainsString('the 6-month average for IT equipment in IT & Systems', $v->ai_anomaly_reason);
        $this->assertDatabaseHas('notifications', ['recipient_id' => $this->officer->id, 'type' => 'anomaly_flagged', 'voucher_id' => $id]);

        $this->api('GET', '/officer/flagged')->assertOk()
            ->assertJsonPath('data.0.id', $id)
            ->assertJsonPath('data.0.tags.0.label', 'Unusual amount')
            ->assertJsonPath('data.0.clerk', 'Liza M.')
            ->assertJsonPath('meta.stats.flagged_this_month', 1)
            ->assertJsonPath('meta.stats.threshold', 0.6);

        $inv = $this->api('GET', "/officer/vouchers/{$id}/investigation")->assertOk()
            ->assertJsonPath('data.months_with_spending', 4)
            ->assertJsonPath('data.average', '40250.00')
            ->assertJsonCount(6, 'data.history');
        $this->assertStringContainsString('average month', $inv->json('data.summary'));

        // flagged + "AI-flagged → step 2" (on by default): the review page says it goes to the Supervisor
        $this->api('GET', "/officer/vouchers/{$id}")->assertJsonPath('data.review.step2_reasons', ['high_value', 'ai_flagged']);
    }

    public function test_possible_duplicate_and_normal_vouchers(): void
    {
        $first = $this->submit('7520.00', 'Grab for Business');
        $this->assertSame(0, (int) DB::table('vouchers')->where('id', $first)->value('ai_anomaly_flag')); // new small payee: fine

        $second = $this->submit('7840.00', 'Grab for Business');
        $v = DB::table('vouchers')->find($second);
        $this->assertSame(1, (int) $v->ai_anomaly_flag);
        $this->assertSame('0.70', (string) $v->ai_anomaly_score);
        $this->assertStringContainsString('Same payee and similar amount submitted', $v->ai_anomaly_reason);
    }

    public function test_sensitivity_moves_the_threshold(): void
    {
        // the payee is usually Fuel: a different category is "medium" (0.45), flagged only when Strict
        $this->history([1 => '1000.00', 2 => '1200.00', 3 => '900.00', 4 => '1100.00', 5 => '950.00'], 'Petron Corporation', $this->fuel);
        $balanced = $this->submit('3000.00', 'Petron Corporation');
        $this->assertSame(0, (int) DB::table('vouchers')->where('id', $balanced)->value('ai_anomaly_flag'));

        $this->sensitivity('strict');
        $strict = $this->submit('4000.00', 'Petron Corporation'); // not within 10% of the first: no duplicate signal
        $this->assertSame(1, (int) DB::table('vouchers')->where('id', $strict)->value('ai_anomaly_flag'));
        $this->assertStringContainsString('usually Fuel', DB::table('vouchers')->where('id', $strict)->value('ai_anomaly_reason'));
    }

    public function test_false_alarm_clears_the_flag_and_the_route(): void
    {
        $this->submit('7520.00', 'Grab for Business');
        $id = $this->submit('7840.00', 'Grab for Business');

        $this->api('POST', "/officer/vouchers/{$id}/normal", ['note' => 'Different billing period.'])->assertOk()->assertJsonPath('data.next_flagged_id', null);
        $v = DB::table('vouchers')->find($id);
        $this->assertSame(0, (int) $v->ai_anomaly_flag);
        $this->assertSame('false_alarm', $v->ai_review_finding);
        $this->assertSame($this->officer->id, (int) $v->ai_reviewed_by);
        $this->assertDatabaseHas('audit_logs', ['action' => 'voucher_flag_cleared', 'record_id' => $id]);

        $this->api('POST', "/officer/vouchers/{$id}/normal")->assertStatus(409)->assertJsonPath('code', 'FLAG_ALREADY_REVIEWED');
        $this->api('GET', "/officer/vouchers/{$id}")->assertJsonPath('data.review.step2_reasons', []); // no Supervisor because of the flag
        $this->api('GET', '/officer/flagged')->assertJsonCount(0, 'data')->assertJsonPath('meta.stats.cleared', 1);
    }

    public function test_findings_are_saved_with_the_decision_and_reset_on_resubmit(): void
    {
        $this->submit('7520.00', 'Grab for Business');
        $high = $this->submit('7840.00', 'Grab for Business');

        $this->api('POST', "/officer/vouchers/{$high}/return", ['needs_changes' => ['line_items'], 'remarks' => 'Show the billing period.', 'ai_finding' => 'needs_changes'])->assertOk();
        $this->assertSame('needs_changes', DB::table('vouchers')->where('id', $high)->value('ai_review_finding'));
        $this->api('GET', '/officer/flagged')->assertJsonPath('meta.stats.confirmed', 1)->assertJsonPath('meta.stats.confirmed_amount', '7840.00');

        // fixed + resubmitted: a fresh check, the old finding is gone (still a possible duplicate, so flagged again)
        $this->api('POST', "/vouchers/{$high}/submit", [], $this->clerk)->assertOk();
        $v = DB::table('vouchers')->find($high);
        $this->assertNull($v->ai_review_finding);
        $this->assertSame(1, (int) $v->ai_anomaly_flag);

        $this->api('POST', "/officer/vouchers/{$high}/approve", ['ai_finding' => 'valid_high'])->assertOk()->assertJsonPath('data.status', 'under_review');
        $this->assertSame('valid_high', DB::table('vouchers')->where('id', $high)->value('ai_review_finding'));
        $this->api('POST', "/officer/vouchers/{$high}/approve", ['ai_finding' => 'false_alarm'])->assertStatus(422);
    }

    public function test_only_officers_of_the_company(): void
    {
        $id = $this->submit('500.00');
        $this->api('GET', '/officer/flagged', [], $this->clerk)->assertForbidden();
        $this->api('POST', "/officer/vouchers/{$id}/normal", [], $this->clerk)->assertForbidden();

        $other = Company::factory()->create();
        $stranger = User::factory()->officer()->create(['company_id' => $other->id]);
        $stranger->accessibleCompanies()->attach($other->id, ['granted_status' => 'accepted']);
        $this->actingAs($stranger)->json('GET', "/api/v1/officer/vouchers/{$id}/investigation", [], ['X-Company-ID' => (string) $other->id])->assertNotFound();
    }
}
