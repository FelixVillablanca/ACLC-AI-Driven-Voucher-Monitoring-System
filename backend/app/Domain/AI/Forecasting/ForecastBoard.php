<?php

namespace App\Domain\AI\Forecasting;

use App\Domain\Budgets\Support\FiscalYear;
use App\Domain\Platform\SystemSettings;
use App\Domain\Vouchers\VoucherStatus as S;
use App\Models\BudgetAllocation;
use App\Models\Company;
use App\Models\Department;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * What the Accounting Officer's Forecasts pages show (2026-11-27), for the company in X-Company-ID:
 *   overview($months)             Framer GWmqqOmd7: company actual vs forecast chart + one row per department
 *   department($id, $months)      Framer sjtX1kKqt: forecast, budget left, confidence, chart, what's driving it,
 *                                 and a top-up recommendation when the forecast goes past the budget
 * $months = how many months AFTER the current one to look at (1–3).
 * "Expected" = what's still likely to be spent: the rest of this month's forecast (forecast − approved so far)
 * + the forecasts of the next months, but never past the end of the fiscal year (next year has its own budget).
 * Risk = expected vs the department's budget left: Over (more than left) · Tight (85%+ of it) · On track.
 * Real data only: no forecast without 3+ months of history; accuracy only once a forecast month has ended.
 */
class ForecastBoard
{
    private const IN_REVIEW = [S::Pending->value, S::UnderReview->value];

    private Carbon $thisMonth;

    public function __construct(private Company $company, private GenerateForecasts $generator)
    {
        $this->thisMonth = Carbon::now()->startOfMonth();
    }

    /** This month's forecasts exist? If not (new month, first visit), work them out now. */
    public function ensureFresh(): void
    {
        $fresh = DB::table('ai_forecasts')->where('company_id', $this->company->id)
            ->where('generated_at', '>=', $this->thisMonth)->exists();
        if (! $fresh) {
            $this->generator->forCompany($this->company);
        }
    }

    public function overview(int $months): array
    {
        $forecasts = $this->forecasts();
        $company = $forecasts->get('company', collect());
        $budgets = $this->budgets();
        $actualThisMonth = $this->approvedThisMonth();

        $rows = Department::query()->where('company_id', $this->company->id)
            ->where(fn ($q) => $q->where('is_active', true)->orWhereIn('id', $forecasts->keys()->filter(fn ($k) => $k !== 'company')))
            ->orderBy('name')->get(['id', 'name', 'is_active'])
            ->map(function (Department $d) use ($forecasts, $budgets, $actualThisMonth, $months) {
                $f = $forecasts->get($d->id);

                return [
                    'department' => ['id' => $d->id, 'name' => $d->name, 'is_active' => (bool) $d->is_active],
                    'forecast' => $f ? $this->window($f, $months) : null,
                    // next month on its own (the Supervisor's "December by department", Framer wY0BB3HcK)
                    'next_month' => ($n = $f?->get($this->thisMonth->copy()->addMonthNoOverflow()->toDateString())) ? $this->point($n) : null,
                    'months_used' => $f ? (int) $f->first()->months_used : count(GenerateForecasts::history($this->company, $d->id)),
                    'risk' => $this->risk($f, $budgets->get($d->id), $actualThisMonth[$d->id] ?? '0.00', $months),
                ];
            })
            ->sortBy(fn ($r) => [self::RISK_ORDER[$r['risk']['level']], $r['department']['name']])->values();

        $first = $company->first();

        return [
            'company' => $this->company->name,
            'months' => $months,
            'generated_at' => $first?->generated_at ? Carbon::parse($first->generated_at)->toIso8601String() : null,
            'method' => $first?->method,
            'months_used' => $first ? (int) $first->months_used : count(GenerateForecasts::history($this->company, null)),
            'min_months' => LinearTrend::MIN_MONTHS,
            'r_squared' => $first ? (float) $first->r_squared : null,
            'accuracy' => $this->accuracy(null),
            'chart' => $this->chart(null, $company, $months, 5),
            'next_month' => $company->get($this->thisMonth->copy()->addMonthNoOverflow()->toDateString())
                ? $this->point($company->get($this->thisMonth->copy()->addMonthNoOverflow()->toDateString())) : null,
            'this_month' => [
                'approved' => $this->approvedCompanyThisMonth(),
                'forecast' => ($c = $company->get($this->thisMonth->toDateString())) ? (string) $c->predicted_spend : null,
            ],
            'rows' => $rows->all(),
        ];
    }

    public function department(int $departmentId, int $months): array
    {
        $department = Department::query()->where('company_id', $this->company->id)->findOrFail($departmentId);
        $f = $this->forecasts()->get($department->id);
        $budget = $this->budgets()->get($department->id);
        $actual = $this->approvedThisMonth()[$department->id] ?? '0.00';
        $risk = $this->risk($f, $budget, $actual, $months);
        $next = $f?->get($this->thisMonth->copy()->addMonthNoOverflow()->toDateString());
        $year = FiscalYear::current($this->company);

        return [
            'company' => $this->company->name,
            'months' => $months,
            'department' => ['id' => $department->id, 'name' => $department->name, 'is_active' => (bool) $department->is_active],
            'generated_at' => $f?->first()?->generated_at ? Carbon::parse($f->first()->generated_at)->toIso8601String() : null,
            'months_used' => $f ? (int) $f->first()->months_used : count(GenerateForecasts::history($this->company, $department->id)),
            'min_months' => LinearTrend::MIN_MONTHS,
            'r_squared' => $f ? (float) $f->first()->r_squared : null,
            'slope' => $f ? $this->slope($department->id) : null,
            'next_month' => $next ? $this->point($next) : null,
            'window' => $f ? $this->window($f, $months) : null,
            'risk' => $risk,
            'accuracy' => $this->accuracy($department->id),
            'chart' => $this->chart($department->id, $f ?? collect(), $months, 6),
            'drivers' => $this->drivers($department->id, $f),
            'recommendation' => $this->recommendation($risk, $department->id),
            'budget' => $budget ? [
                'id' => $budget->id,
                'total' => (string) $budget->total_budget,
                'used' => (string) $budget->used_amount,
                'used_pct' => BudgetAllocation::pct((string) $budget->used_amount, (string) $budget->total_budget, 1),
                'alert_pct' => (float) $budget->alert_threshold_pct,
                'pending_request' => DB::table('budget_change_requests')->where('budget_allocation_id', $budget->id)->where('status', 'pending')->exists(),
            ] : null,
            'fiscal_year' => $year,
            'year_label' => FiscalYear::label($this->company, $year),
            'signoff_above' => (string) app(SystemSettings::class)->value(SystemSettings::BUDGET_CHANGE_SIGNOFF_ABOVE),
        ];
    }

    /**
     * Where this fiscal year is heading (the Supervisor's "Year-end projection", Framer wY0BB3HcK), for the company
     * ($departmentId null) or one department: approved so far this FY + the rest of this month's forecast + the stored
     * forecasts of the following months inside the FY. Forecasts are stored 3 months ahead, so `complete` says whether
     * the projection reaches the end of the FY; `through` is the last month it covers. `plan` = this FY's budget(s).
     *
     * @return array{label: string, approved: string, expected: ?string, projection: ?string, through: ?string, complete: bool, plan: ?string, diff: ?string}
     */
    public function yearEnd(?int $departmentId): array
    {
        $year = FiscalYear::current($this->company);
        [$from, $to] = FiscalYear::range($this->company, $year);
        $approved = (string) DB::table('vouchers')->where('company_id', $this->company->id)->where('status', S::Approved->value)
            ->when($departmentId, fn ($q) => $q->where('department_id', $departmentId))
            ->whereBetween('approved_at', [$from, $to])->selectRaw('COALESCE(SUM(amount), 0) as t')->value('t');
        $budgets = $this->budgets();
        $plan = $departmentId
            ? ($budgets->get($departmentId) ? (string) $budgets->get($departmentId)->total_budget : null)
            : ($budgets->isEmpty() ? null : (string) $budgets->reduce(fn ($c, $b) => bcadd($c, (string) $b->total_budget, 2), '0.00'));
        $base = ['label' => FiscalYear::label($this->company, $year), 'approved' => number_format((float) $approved, 2, '.', ''),
            'expected' => null, 'projection' => null, 'through' => null, 'complete' => false, 'plan' => $plan, 'diff' => null];

        $f = $this->forecasts()->get($departmentId ?? 'company');
        if (! $f) {
            return $base;
        }
        $soFar = (float) ($departmentId ? ($this->approvedThisMonth()[$departmentId] ?? 0) : $this->approvedCompanyThisMonth());
        $expected = max(0.0, (float) ($f->get($this->thisMonth->toDateString())->predicted_spend ?? 0) - $soFar);
        $through = $this->thisMonth->copy();
        foreach ($f as $month => $row) {
            $m = Carbon::parse($month);
            if ($m->gt($this->thisMonth) && $m->lte($to)) {
                $expected += (float) $row->predicted_spend;
                $through = $m;
            }
        }
        $projection = (float) $approved + $expected;

        return array_merge($base, [
            'expected' => number_format($expected, 2, '.', ''),
            'projection' => number_format($projection, 2, '.', ''),
            'through' => $through->format('F Y'),
            'complete' => $through->format('Y-m') === $to->format('Y-m'),
            'diff' => $plan !== null ? number_format($projection - (float) $plan, 2, '.', '') : null,
        ]);
    }

    private const RISK_ORDER = ['over' => 0, 'tight' => 1, 'on_track' => 2, 'no_budget' => 3, 'no_forecast' => 4];

    /** @return Collection<int|string, Collection<string, object>> forecasts by department id ('company' = whole company), keyed by month */
    private function forecasts(): Collection
    {
        return DB::table('ai_forecasts')->where('company_id', $this->company->id)
            ->where('forecast_for_month', '>=', $this->thisMonth->toDateString())->orderBy('forecast_for_month')->get()
            ->groupBy(fn ($r) => $r->department_id ?? 'company')
            ->map(fn ($rows) => $rows->keyBy(fn ($r) => Carbon::parse($r->forecast_for_month)->toDateString()));
    }

    /** This fiscal year's budgets by department id. */
    private function budgets(): Collection
    {
        return BudgetAllocation::query()->where('company_id', $this->company->id)
            ->where('fiscal_year', FiscalYear::current($this->company))->get()->keyBy('department_id');
    }

    /** @return array<int, string> approved so far this month, by department id */
    private function approvedThisMonth(): array
    {
        return DB::table('vouchers')->where('company_id', $this->company->id)->where('status', S::Approved->value)
            ->where('approved_at', '>=', $this->thisMonth)->whereNotNull('department_id')
            ->groupBy('department_id')->selectRaw('department_id, SUM(amount) as t')->pluck('t', 'department_id')
            ->map(fn ($v) => (string) $v)->all();
    }

    private function approvedCompanyThisMonth(): string
    {
        return (string) DB::table('vouchers')->where('company_id', $this->company->id)->where('status', S::Approved->value)
            ->where('approved_at', '>=', $this->thisMonth)->selectRaw('COALESCE(SUM(amount), 0) as t')->value('t');
    }

    /** The months after this one that the page looks at, but not past the end of the fiscal year. */
    private function windowMonths(int $months): array
    {
        [, $fyEnd] = FiscalYear::range($this->company, FiscalYear::current($this->company));
        $list = [];
        for ($k = 1; $k <= $months; $k++) {
            $m = $this->thisMonth->copy()->addMonthsNoOverflow($k);
            $list[] = ['month' => $m->toDateString(), 'in_year' => $m->lte($fyEnd)];
        }

        return $list;
    }

    /** Sum of the next $months forecasts (+ range, average confidence). */
    private function window(Collection $f, int $months): array
    {
        $rows = collect($this->windowMonths($months))->map(fn ($m) => $f->get($m['month']))->filter();

        return [
            'months' => $rows->map(fn ($r) => Carbon::parse($r->forecast_for_month)->format('M'))->values()->all(),
            'predicted' => number_format($rows->sum(fn ($r) => (float) $r->predicted_spend), 2, '.', ''),
            'lower' => number_format($rows->sum(fn ($r) => (float) $r->lower_bound), 2, '.', ''),
            'upper' => number_format($rows->sum(fn ($r) => (float) $r->upper_bound), 2, '.', ''),
            'confidence' => $rows->isEmpty() ? 0 : (int) round($rows->avg(fn ($r) => (float) $r->confidence_score) * 100),
        ];
    }

    private function point(object $r): array
    {
        return [
            'month' => Carbon::parse($r->forecast_for_month)->toDateString(),
            'label' => Carbon::parse($r->forecast_for_month)->format('F'),
            'predicted' => (string) $r->predicted_spend,
            'lower' => (string) $r->lower_bound,
            'upper' => (string) $r->upper_bound,
            'confidence' => (int) round((float) $r->confidence_score * 100),
        ];
    }

    /**
     * Expected spending until the window / fiscal-year end vs the budget left.
     *
     * @return array{level: string, expected: ?string, budget_left: ?string, shortfall: ?string, pct: ?int, until: ?string, capped: bool}
     */
    private function risk(?Collection $f, ?BudgetAllocation $budget, string $approvedThisMonth, int $months): array
    {
        $base = ['expected' => null, 'budget_left' => null, 'shortfall' => null, 'pct' => null, 'until' => null, 'capped' => false];
        if (! $f) {
            return ['level' => 'no_forecast'] + $base;
        }
        $window = collect($this->windowMonths($months));
        $inYear = $window->where('in_year', true);
        $current = $f->get($this->thisMonth->toDateString());
        $expected = max(0.0, (float) ($current->predicted_spend ?? 0) - (float) $approvedThisMonth)
            + $inYear->sum(fn ($m) => (float) ($f->get($m['month'])->predicted_spend ?? 0));
        $until = Carbon::parse(($inYear->last() ?? ['month' => $this->thisMonth->toDateString()])['month'])->format('F Y');
        $base = ['expected' => number_format($expected, 2, '.', ''), 'until' => $until, 'capped' => $inYear->count() < $window->count()] + $base;
        if (! $budget) {
            return ['level' => 'no_budget'] + $base;
        }
        $left = (float) $budget->total_budget - (float) $budget->used_amount;
        $pct = $left > 0 ? (int) round($expected / $left * 100) : null;
        $level = $expected > $left ? 'over' : ($pct !== null && $pct >= 85 ? 'tight' : 'on_track');

        return array_merge($base, [
            'level' => $level,
            'budget_left' => number_format($left, 2, '.', ''),
            'shortfall' => $expected > $left ? number_format($expected - $left, 2, '.', '') : null,
            'pct' => $pct,
        ]);
    }

    /**
     * Actual approved spending for the last $past complete months + this month so far, then the forecasts.
     *
     * @return list<array{month: string, label: string, kind: string, actual: ?string, predicted: ?string, lower: ?string, upper: ?string}>
     */
    private function chart(?int $departmentId, Collection $f, int $months, int $past): array
    {
        $history = GenerateForecasts::history($this->company, $departmentId);
        $points = [];
        for ($k = $past; $k >= 1; $k--) {
            $m = $this->thisMonth->copy()->subMonthsNoOverflow($k);
            $points[] = ['month' => $m->toDateString(), 'label' => $m->format('M'), 'kind' => 'actual', 'actual' => $history[$m->format('Y-m')] ?? '0.00',
                'predicted' => null, 'lower' => null, 'upper' => null];
        }
        $now = $f->get($this->thisMonth->toDateString());
        $sofar = $departmentId ? ($this->approvedThisMonth()[$departmentId] ?? '0.00') : $this->approvedCompanyThisMonth();
        $points[] = ['month' => $this->thisMonth->toDateString(), 'label' => $this->thisMonth->format('M'), 'kind' => 'current', 'actual' => $sofar,
            'predicted' => $now ? (string) $now->predicted_spend : null, 'lower' => $now ? (string) $now->lower_bound : null, 'upper' => $now ? (string) $now->upper_bound : null];
        foreach ($this->windowMonths($months) as $m) {
            $r = $f->get($m['month']);
            $points[] = ['month' => $m['month'], 'label' => Carbon::parse($m['month'])->format('M'), 'kind' => 'forecast', 'actual' => null,
                'predicted' => $r ? (string) $r->predicted_spend : null, 'lower' => $r ? (string) $r->lower_bound : null, 'upper' => $r ? (string) $r->upper_bound : null];
        }

        return $points;
    }

    /** How close earlier forecasts were: 100% − the average miss, over the last 6 finished months that had one. */
    private function accuracy(?int $departmentId): ?array
    {
        $rows = DB::table('ai_forecasts')->where('company_id', $this->company->id)
            ->when($departmentId, fn ($q) => $q->where('department_id', $departmentId), fn ($q) => $q->whereNull('department_id'))
            ->where('forecast_for_month', '<', $this->thisMonth->toDateString())
            ->where('forecast_for_month', '>=', $this->thisMonth->copy()->subMonthsNoOverflow(6)->toDateString())->get();
        if ($rows->isEmpty()) {
            return null;
        }
        $history = GenerateForecasts::history($this->company, $departmentId);
        $misses = $rows->map(function ($r) use ($history) {
            $actual = (float) ($history[Carbon::parse($r->forecast_for_month)->format('Y-m')] ?? 0);
            $predicted = (float) $r->predicted_spend;
            $bigger = max($actual, $predicted);

            return $bigger > 0 ? abs($actual - $predicted) / $bigger : 0.0;
        });

        return ['pct' => (int) round((1 - $misses->avg()) * 100), 'months' => $rows->count()];
    }

    /** The trend per month (₱ more or less each month), from the stored line. */
    private function slope(int $departmentId): ?string
    {
        $trend = LinearTrend::fit(array_values(GenerateForecasts::history($this->company, $departmentId)));

        return $trend ? number_format($trend->slope, 2, '.', '') : null;
    }

    /** Real reasons behind the forecast: vouchers in review, the trend, the same month last year, payees it repeats. */
    private function drivers(int $departmentId, ?Collection $f): array
    {
        $drivers = [];
        $pending = DB::table('vouchers')->where('company_id', $this->company->id)->where('department_id', $departmentId)->whereIn('status', self::IN_REVIEW);
        $count = (clone $pending)->count();
        if ($count) {
            $drivers[] = ['kind' => 'pending', 'count' => $count, 'amount' => (string) (clone $pending)->selectRaw('COALESCE(SUM(amount), 0) as t')->value('t'),
                'vouchers' => (clone $pending)->orderByDesc('amount')->limit(2)->get(['id', 'voucher_number', 'payee_name', 'amount'])
                    ->map(fn ($v) => ['id' => $v->id, 'voucher_number' => $v->voucher_number, 'payee_name' => $v->payee_name, 'amount' => (string) $v->amount])->all()];
        }
        $slope = $f ? $this->slope($departmentId) : null;
        if ($slope !== null) {
            $drivers[] = ['kind' => 'trend', 'per_month' => $slope];
        }
        $next = $this->thisMonth->copy()->addMonthNoOverflow();
        $lastYear = $next->copy()->subYear();
        $history = GenerateForecasts::history($this->company, $departmentId);
        if (isset($history[$lastYear->format('Y-m')]) && count($history) >= 12) {
            $year = array_slice($history, -12, 12, true);
            $avg = array_sum(array_map('floatval', $year)) / 12;
            $value = (float) $history[$lastYear->format('Y-m')];
            if ($avg > 0) {
                $drivers[] = ['kind' => 'seasonal', 'month' => $lastYear->format('F Y'), 'amount' => number_format($value, 2, '.', ''),
                    'vs_average_pct' => (int) round(($value - $avg) / $avg * 100)];
            }
        }
        $repeat = DB::table('vouchers')->where('company_id', $this->company->id)->where('department_id', $departmentId)
            ->where('status', S::Approved->value)->whereBetween('approved_at', [$lastYear->copy()->startOfMonth(), $lastYear->copy()->endOfMonth()])
            ->whereNotNull('payee_name')->groupBy('payee_name')->selectRaw('payee_name, SUM(amount) as t')->orderByDesc('t')->limit(2)->get();
        foreach ($repeat as $r) {
            $drivers[] = ['kind' => 'repeat_payee', 'payee' => $r->payee_name, 'month' => $lastYear->format('F Y'), 'amount' => (string) $r->t];
        }

        return $drivers;
    }

    /** Over budget → top up by the shortfall rounded up to ₱10,000 (and the biggest voucher in review, which could wait). */
    private function recommendation(array $risk, int $departmentId): ?array
    {
        if ($risk['level'] !== 'over') {
            return null;
        }
        $topUp = (string) (ceil((float) $risk['shortfall'] / 10000) * 10000);
        $biggest = DB::table('vouchers')->where('company_id', $this->company->id)->where('department_id', $departmentId)
            ->whereIn('status', self::IN_REVIEW)->orderByDesc('amount')->first(['id', 'voucher_number', 'amount']);

        return [
            'top_up' => number_format((float) $topUp, 2, '.', ''),
            'defer' => $biggest ? ['id' => $biggest->id, 'voucher_number' => $biggest->voucher_number, 'amount' => (string) $biggest->amount] : null,
        ];
    }
}
