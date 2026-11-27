<?php

namespace App\Domain\AI\Forecasting;

use App\Domain\Vouchers\VoucherStatus as S;
use App\Models\Company;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Works out and STORES the spending forecasts of one company (2026-11-27; Framer GWmqqOmd7 / sjtX1kKqt).
 * For the whole company and for every department with approved spending:
 *   1. history = approved spending per month (by approved_at), from its first month with spending, at most
 *      24 months, ending with LAST month (the current month isn't finished, so it isn't history yet)
 *   2. LinearTrend fits a straight line through it (needs 3+ months, else no forecast: "not enough history")
 *   3. the line gives THIS month + the next 3 → rows in ai_forecasts (method linear_trend)
 * Rows for this month and later are replaced in one transaction (the company row is locked, so two runs
 * can't both write); rows for past months stay, so the page can show how accurate earlier forecasts were.
 * Runs on the 1st of every month (forecasts:generate), when a page finds this month's forecast missing,
 * and on "Recalculate".
 */
class GenerateForecasts
{
    public const HORIZON = 3; // months after the current one

    public const HISTORY = 24;

    public const MODEL_VERSION = 'linear-trend-v1';

    /** @return int how many forecast rows were written */
    public function forCompany(Company $company): int
    {
        return DB::transaction(function () use ($company) {
            Company::query()->whereKey($company->id)->lockForUpdate()->first();
            $thisMonth = Carbon::now()->startOfMonth();
            DB::table('ai_forecasts')->where('company_id', $company->id)->where('forecast_for_month', '>=', $thisMonth->toDateString())->delete();

            $rows = [];
            $targets = DB::table('vouchers')->where('company_id', $company->id)->where('status', S::Approved->value)
                ->whereNotNull('department_id')->distinct()->pluck('department_id')->map(fn ($id) => (int) $id)->all();
            foreach ([null, ...$targets] as $departmentId) {
                array_push($rows, ...$this->rowsFor($company, $departmentId, $thisMonth));
            }
            foreach (array_chunk($rows, 200) as $chunk) {
                DB::table('ai_forecasts')->insert($chunk);
            }

            return count($rows);
        });
    }

    /**
     * Approved spending per month, oldest first: ['2026-01' => '120000.00', …] for complete months only.
     * $departmentId null = the whole company (incl. vouchers without a department).
     *
     * @return array<string, string>
     */
    public static function history(Company $company, ?int $departmentId, ?Carbon $before = null): array
    {
        $before ??= Carbon::now()->startOfMonth();
        $base = DB::table('vouchers')->where('company_id', $company->id)->where('status', S::Approved->value)
            ->whereNotNull('approved_at')->where('approved_at', '<', $before)
            ->when($departmentId, fn ($q) => $q->where('department_id', $departmentId));
        $first = (clone $base)->min('approved_at');
        if (! $first) {
            return [];
        }
        $start = Carbon::parse($first)->startOfMonth()->max($before->copy()->subMonthsNoOverflow(self::HISTORY));
        $sums = (clone $base)->where('approved_at', '>=', $start)
            ->selectRaw("DATE_FORMAT(approved_at, '%Y-%m') as ym, SUM(amount) as total")->groupBy('ym')->pluck('total', 'ym');

        $months = [];
        for ($m = $start->copy(); $m->lt($before); $m->addMonthNoOverflow()) {
            $months[$m->format('Y-m')] = (string) ($sums[$m->format('Y-m')] ?? '0.00');
        }

        return $months;
    }

    private function rowsFor(Company $company, ?int $departmentId, Carbon $thisMonth): array
    {
        $history = self::history($company, $departmentId, $thisMonth);
        $trend = LinearTrend::fit(array_values($history));
        if (! $trend) {
            return [];
        }
        $now = now();
        $rows = [];
        for ($k = 0; $k <= self::HORIZON; $k++) {
            $p = $trend->predict($trend->n + $k); // x = n is this month (history ends last month)
            $rows[] = [
                'company_id' => $company->id,
                'department_id' => $departmentId,
                'forecast_for_month' => $thisMonth->copy()->addMonthsNoOverflow($k)->toDateString(),
                'predicted_spend' => $p['value'],
                'lower_bound' => $p['lower'],
                'upper_bound' => $p['upper'],
                'confidence_score' => $p['confidence'],
                'r_squared' => round($trend->rSquared, 4),
                'months_used' => $trend->n,
                'method' => 'linear_trend',
                'model_version' => self::MODEL_VERSION,
                'generated_at' => $now,
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        return $rows;
    }
}
