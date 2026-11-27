<?php

namespace Tests\Feature\Api;

use App\Domain\AI\OpenAi\OpenAiClient;
use App\Domain\AI\OpenAi\OpenAiSpend;
use App\Domain\Platform\SystemSettings;
use App\Jobs\WriteReportSummary;
use App\Models\Company;
use App\Models\Department;
use App\Models\FinancialReport;
use App\Models\User;
use App\Models\VoucherCategory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request as HttpRequest;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use RuntimeException;
use Tests\TestCase;

/**
 * Financial reports (2026-11-27; Framer ARxG8Aa6F list, UmSNc_71u report, ZoAX4DKjk generate):
 * frozen figures, the OpenAI summary (faked here: no real calls, nothing spent), cap / not set up, downloads,
 * the automatic monthly report, and the tenancy / role rules.
 * Run:  php artisan test --filter=ReportsTest
 */
class ReportsTest extends TestCase
{
    use RefreshDatabase;

    private Company $apex;

    private Company $north;

    private User $officer;

    private User $clerk;

    private Department $it;

    private int $category;

    protected function setUp(): void
    {
        parent::setUp();
        $this->travelTo(now()->setDate(2026, 11, 15)->setTime(10, 0));
        config(['services.openai.key' => null]);
        $this->apex = Company::factory()->create(['name' => 'Apex Holdings Inc.', 'fiscal_year_start' => null]);
        $this->north = Company::factory()->create(['name' => 'Northfield']);
        $this->officer = User::factory()->officer()->create(['first_name' => 'Maria', 'last_name' => 'Santos', 'company_id' => $this->apex->id]);
        $this->clerk = User::factory()->create(['company_id' => $this->apex->id]);
        foreach ([$this->officer, $this->clerk] as $u) {
            $u->accessibleCompanies()->attach($this->apex->id, ['granted_status' => 'accepted']);
        }
        $this->it = Department::factory()->for($this->apex)->create(['name' => 'IT & Systems']);
        $this->category = VoucherCategory::create(['company_id' => $this->apex->id, 'name' => 'Equipment'])->id;
        $this->approved('300000', '2026-09-10');
        $this->approved('200000', '2026-10-05');
        $this->approved('150000', '2026-10-20', 'Juan Personal Payee');
    }

    private function api(string $method, string $uri, array $data = [], ?User $as = null, ?int $company = null)
    {
        return $this->actingAs($as ?? $this->officer)->json($method, '/api/v1'.$uri, $data, ['X-Company-ID' => (string) ($company ?? $this->apex->id)]);
    }

    private function approved(string $amount, string $date, string $payee = 'Dell'): void
    {
        static $n = 0;
        $n++;
        DB::table('vouchers')->insert([
            'voucher_number' => "AH-2026-R{$n}", 'company_id' => $this->apex->id, 'department_id' => $this->it->id, 'created_by' => $this->clerk->id,
            'category_id' => $this->category, 'payee_name' => $payee, 'payment_method' => 'cash', 'amount' => $amount, 'status' => 'approved',
            'submitted_at' => $date, 'approved_at' => $date, 'created_at' => $date, 'updated_at' => $date,
        ]);
    }

    private function fakeOpenAi(): void
    {
        config(['services.openai.key' => 'sk-test']);
        Http::fake(['api.openai.com/*' => Http::response([
            'model' => 'gpt-4o-mini-2024-07-18',
            'choices' => [['message' => ['content' => json_encode([
                'paragraphs' => ['Apex spent ₱350k in October, 17% more than September.', 'IT & Systems drove all of it.'],
                'highlights' => [['text' => 'Spend +17%', 'tone' => 'warning']],
            ])]]],
            'usage' => ['prompt_tokens' => 1000, 'completion_tokens' => 200],
        ])]);
    }

    public function test_generate_without_openai_freezes_figures(): void
    {
        $id = $this->api('POST', '/officer/reports', ['type' => 'monthly', 'period' => '2026-10'])->assertCreated()
            ->assertJsonPath('data.title', 'October 2026 · Monthly expense report')
            ->assertJsonPath('data.figures.total_spend', '350000.00')
            ->assertJsonPath('data.figures.previous_spend', '300000.00')
            ->assertJsonPath('data.figures.change_pct', 17)
            ->assertJsonPath('data.figures.departments.0.name', 'IT & Systems')
            ->json('data.id');

        $this->assertSame('not_set_up', FinancialReport::find($id)->summary_status);
        $this->assertDatabaseHas('audit_logs', ['action' => 'report_generated', 'record_id' => $id]);

        // frozen: a new approval in October doesn't change the saved report
        $this->approved('999', '2026-10-25');
        $this->api('GET', "/officer/reports/{$id}")->assertOk()->assertJsonPath('data.figures.total_spend', '350000.00');

        $this->api('GET', '/officer/reports')->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('meta.stats.this_year.monthly', 1)
            ->assertJsonPath('meta.ai.configured', false)
            ->assertJsonPath('data.0.summary_status', 'not_set_up');
    }

    public function test_openai_summary_is_written_and_sends_totals_only(): void
    {
        $this->fakeOpenAi();

        $id = $this->api('POST', '/officer/reports', ['type' => 'monthly', 'period' => '2026-10'])->assertCreated()->json('data.id');

        $report = FinancialReport::find($id);
        $this->assertSame('ready', $report->summary_status);
        $this->assertStringContainsString('₱350k', $report->ai_summary);
        $this->assertSame([['text' => 'Spend +17%', 'tone' => 'warning']], $report->summary_highlights);
        $this->assertSame(1200, $report->summary_tokens);
        $this->assertEqualsWithDelta(0.00027, (float) $report->summary_cost_usd, 0.000001);
        $this->assertDatabaseHas('notifications', ['recipient_id' => $this->officer->id, 'type' => 'report_ready']);
        Http::assertSent(fn (HttpRequest $r) => ! str_contains($r->body(), 'Juan Personal Payee') && str_contains($r->body(), '350000.00'));

        $this->api('GET', "/officer/reports/{$id}")->assertOk()->assertJsonCount(2, 'data.summary');
        $this->assertSame('0.0003', app(OpenAiSpend::class)->thisMonth());
    }

    public function test_cap_pauses_and_failure_is_recorded(): void
    {
        config(['services.openai.key' => 'sk-test']); // OpenAI "set up"; every call below answers 429
        Http::fake(['api.openai.com/*' => Http::response(['error' => ['message' => 'Rate limit']], 429)]);
        DB::table('system_settings')->updateOrInsert(['key' => SystemSettings::OPENAI_MONTHLY_CAP_USD], ['value' => json_encode('0.00'), 'group' => 'openai', 'updated_at' => now()]);
        $id = $this->api('POST', '/officer/reports', ['type' => 'monthly', 'period' => '2026-10'])->assertCreated()->json('data.id');
        $this->assertSame('paused', FinancialReport::find($id)->summary_status);
        DB::table('system_settings')->where('key', SystemSettings::OPENAI_MONTHLY_CAP_USD)->delete();

        // a failing call: the job throws (the queue retries), the last failure marks it failed + notifies
        Queue::fake();
        $this->api('POST', "/officer/reports/{$id}/summary")->assertOk()->assertJsonPath('data.summary_status', 'queued');
        $this->api('POST', "/officer/reports/{$id}/summary")->assertStatus(409)->assertJsonPath('code', 'SUMMARY_IN_PROGRESS');
        $job = new WriteReportSummary($id);
        try {
            $job->handle(app(OpenAiClient::class), app(OpenAiSpend::class));
            $this->fail('Expected the OpenAI error');
        } catch (RuntimeException $e) {
            $job->failed($e);
        }
        $this->assertSame('failed', FinancialReport::find($id)->summary_status);
        $this->api('GET', "/officer/reports/{$id}")->assertJsonPath('data.summary_error', 'OpenAI answered with an error: Rate limit');
    }

    public function test_validation_preview_and_downloads(): void
    {
        $this->api('POST', '/officer/reports', ['type' => 'monthly', 'period' => '2027-01'])->assertStatus(422)->assertJsonValidationErrors(['period']);
        $this->api('POST', '/officer/reports', ['type' => 'custom', 'from' => '2026-10-01', 'to' => '2026-11-10'])->assertStatus(422)->assertJsonValidationErrors(['department_id']);
        $this->api('POST', '/officer/reports', ['type' => 'quarterly', 'period' => 'Q9'])->assertStatus(422);

        $this->api('GET', '/officer/reports/preview?type=quarterly&period=2026-Q3')->assertOk()
            ->assertJsonPath('data.vouchers', 1)->assertJsonPath('data.total', '300000.00');

        $id = $this->api('POST', '/officer/reports', ['type' => 'custom', 'from' => '2026-10-01', 'to' => '2026-12-31', 'department_id' => $this->it->id,
            'includes' => ['summary' => false]])->assertCreated()
            ->assertJsonPath('data.title', 'IT & Systems · Oct 1 – Nov 15, 2026') // the end is cut to today
            ->assertJsonPath('data.summary_status', 'off')->json('data.id');

        $this->api('GET', "/officer/reports/{$id}/pdf")->assertOk()->assertHeader('Content-Type', 'application/pdf');
        $this->api('GET', "/officer/reports/{$id}/xlsx")->assertOk();
        $this->assertSame(2, DB::table('audit_logs')->where('action', 'report_downloaded')->count());
    }

    public function test_automatic_monthly_report_once(): void
    {
        $this->artisan('reports:monthly', ['--company' => $this->apex->id])->assertSuccessful();
        $this->artisan('reports:monthly', ['--company' => $this->apex->id])->assertSuccessful();

        $this->assertSame(1, FinancialReport::where('company_id', $this->apex->id)->where('is_scheduled', true)->count());
        $this->assertDatabaseHas('financial_reports', ['is_scheduled' => true, 'title' => 'October 2026 · Monthly expense report', 'summary_status' => 'not_set_up']);
        $this->assertDatabaseHas('notifications', ['recipient_id' => $this->officer->id, 'type' => 'report_ready']);
    }

    public function test_tenancy_and_roles(): void
    {
        $this->getJson('/api/v1/officer/reports')->assertUnauthorized();
        $this->api('GET', '/officer/reports', [], $this->clerk)->assertForbidden();
        $id = $this->api('POST', '/officer/reports', ['type' => 'monthly', 'period' => '2026-10'])->json('data.id');

        $outsider = User::factory()->officer()->create(['company_id' => $this->north->id]);
        $outsider->accessibleCompanies()->attach($this->north->id, ['granted_status' => 'accepted']);
        $this->api('GET', "/officer/reports/{$id}", [], $outsider, $this->north->id)->assertNotFound();
        $this->api('POST', '/officer/reports', ['type' => 'custom', 'from' => '2026-10-01', 'to' => '2026-10-31', 'department_id' => $this->it->id], $outsider, $this->north->id)
            ->assertStatus(422)->assertJsonValidationErrors(['department_id']);
    }
}
