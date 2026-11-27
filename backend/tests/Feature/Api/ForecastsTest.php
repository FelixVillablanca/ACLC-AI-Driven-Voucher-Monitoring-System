<?php

namespace Tests\Feature\Api;

use App\Domain\AI\Forecasting\LinearTrend;
use App\Models\Company;
use App\Models\Department;
use App\Models\User;
use App\Models\VoucherCategory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Forecasts (2026-11-27; Framer GWmqqOmd7 overview, sjtX1kKqt department): a straight-line trend through
 * each department's approved spending per month, stored in ai_forecasts, compared with the budget left.
 * Run:  php artisan test --filter=ForecastsTest
 */
class ForecastsTest extends TestCase
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
        $this->apex = Company::factory()->create(['name' => 'Apex Holdings Inc.', 'fiscal_year_start' => null]);
        $this->north = Company::factory()->create(['name' => 'Northfield']);
        $this->officer = User::factory()->officer()->create(['company_id' => $this->apex->id]);
        $this->clerk = User::factory()->create(['company_id' => $this->apex->id]);
        foreach ([$this->officer, $this->clerk] as $u) {
            $u->accessibleCompanies()->attach($this->apex->id, ['granted_status' => 'accepted']);
        }
        $this->it = Department::factory()->for($this->apex)->create(['name' => 'IT & Systems']);
        $this->category = VoucherCategory::create(['company_id' => $this->apex->id, 'name' => 'IT equipment'])->id;
    }

    private function api(string $method, string $uri, array $data = [], ?User $as = null, ?int $company = null)
    {
        return $this->actingAs($as ?? $this->officer)->json($method, '/api/v1'.$uri, $data, ['X-Company-ID' => (string) ($company ?? $this->apex->id)]);
    }

    /** An approved voucher of IT on $date. */
    private function approved(string $amount, string $date, ?int $department = null): void
    {
        static $n = 0;
        $n++;
        DB::table('vouchers')->insert([
            'voucher_number' => "AH-2026-{$n}", 'company_id' => $this->apex->id, 'department_id' => $department ?? $this->it->id,
            'created_by' => $this->clerk->id, 'category_id' => $this->category, 'payee_name' => 'Dell', 'payment_method' => 'cash', 'amount' => $amount,
            'status' => 'approved', 'submitted_at' => $date, 'approved_at' => $date, 'created_at' => $date, 'updated_at' => $date,
        ]);
    }

    public function test_linear_trend_math(): void
    {
        $t = LinearTrend::fit([100, 200, 300, 400]); // a perfect line: +100 a month
        $this->assertEqualsWithDelta(100.0, $t->slope, 0.0001);
        $this->assertEqualsWithDelta(1.0, $t->rSquared, 0.0001);
        $p = $t->predict(4);
        $this->assertSame('500.00', $p['value']);
        $this->assertSame('500.00', $p['lower']); // no scatter → no range
        $this->assertNull(LinearTrend::fit([100, 200])); // needs 3 months
    }

    public function test_overview_forecasts_and_risk(): void
    {
        foreach (['2026-07-10' => '100000', '2026-08-10' => '110000', '2026-09-10' => '120000', '2026-10-10' => '130000'] as $d => $a) {
            $this->approved($a, $d);
        }
        DB::table('budget_allocations')->insert([
            'company_id' => $this->apex->id, 'department_id' => $this->it->id, 'fiscal_year' => 2026, 'total_budget' => '600000.00',
            'used_amount' => '460000.00', 'alert_threshold_pct' => 90, 'created_at' => now(), 'updated_at' => now(),
        ]);

        $this->api('GET', '/officer/forecasts?months=1')->assertOk()
            ->assertJsonPath('data.months_used', 4)
            ->assertJsonPath('data.next_month.predicted', '150000.00') // Dec: the line goes +10k a month
            ->assertJsonPath('data.rows.0.department.name', 'IT & Systems')
            ->assertJsonPath('data.rows.0.forecast.predicted', '150000.00')
            ->assertJsonPath('data.rows.0.risk.level', 'over') // Nov 140k + Dec 150k = 290k > 140k left
            ->assertJsonPath('data.rows.0.risk.shortfall', '150000.00');

        $this->assertSame(8, DB::table('ai_forecasts')->where('company_id', $this->apex->id)->count()); // company + IT, Nov–Feb
        $this->assertDatabaseHas('ai_forecasts', ['department_id' => $this->it->id, 'forecast_for_month' => '2026-12-01', 'method' => 'linear_trend', 'months_used' => 4]);

        $this->api('GET', "/officer/forecasts/departments/{$this->it->id}?months=1")->assertOk()
            ->assertJsonPath('data.recommendation.top_up', '150000.00')
            ->assertJsonPath('data.budget.total', '600000.00')
            ->assertJsonPath('data.drivers.0.kind', 'trend')
            ->assertJsonPath('data.chart.6.kind', 'current'); // 6 past months, then this month
    }

    public function test_not_enough_history_and_recalculate(): void
    {
        $this->approved('5000', '2026-10-05');

        $this->api('GET', '/officer/forecasts')->assertOk()
            ->assertJsonPath('data.next_month', null)
            ->assertJsonPath('data.rows.0.risk.level', 'no_forecast')
            ->assertJsonPath('data.min_months', 3);

        $this->approved('6000', '2026-08-05');
        $this->api('POST', '/officer/forecasts/recalculate')->assertOk();
        $this->assertSame(4, DB::table('ai_forecasts')->where('company_id', $this->apex->id)->whereNull('department_id')->count());
    }

    public function test_export_and_command(): void
    {
        foreach (['2026-08-10' => '1000', '2026-09-10' => '2000', '2026-10-10' => '3000'] as $d => $a) {
            $this->approved($a, $d);
        }
        $this->api('GET', '/officer/forecasts/export?format=csv')->assertOk()->assertHeader('Content-Type', 'text/csv; charset=UTF-8');
        $this->assertDatabaseHas('audit_logs', ['action' => 'forecasts_exported']);

        $this->artisan('forecasts:generate', ['--company' => $this->apex->id])->assertSuccessful();
    }

    public function test_tenancy_and_roles(): void
    {
        $this->getJson('/api/v1/officer/forecasts')->assertUnauthorized();
        $this->api('GET', '/officer/forecasts', [], $this->clerk)->assertForbidden();
        $northDept = Department::factory()->for($this->north)->create();
        $this->api('GET', "/officer/forecasts/departments/{$northDept->id}")->assertNotFound();
        $this->api('GET', '/officer/forecasts/export?format=pdf')->assertStatus(422);
    }
}
