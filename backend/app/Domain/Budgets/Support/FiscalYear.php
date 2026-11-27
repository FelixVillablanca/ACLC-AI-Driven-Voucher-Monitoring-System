<?php

namespace App\Domain\Budgets\Support;

use App\Models\Company;
use Illuminate\Support\Carbon;

/**
 * THE fiscal-year rule for budgets (2026-11-27). A company's fiscal year starts on the 1st of the month in
 * companies.fiscal_year_start (January when it isn't set) and runs 12 months. "FY 2026" = the year that
 * STARTS in 2026. The day in fiscal_year_start is ignored: budgets work in whole months.
 */
class FiscalYear
{
    public static function startMonth(Company $company): int
    {
        return $company->fiscal_year_start ? (int) $company->fiscal_year_start->month : 1;
    }

    /** The fiscal year that contains $date (today by default). */
    public static function of(Company $company, ?Carbon $date = null): int
    {
        $date ??= Carbon::now();

        return $date->month >= self::startMonth($company) ? $date->year : $date->year - 1;
    }

    public static function current(Company $company): int
    {
        return self::of($company);
    }

    /** @return array{0: Carbon, 1: Carbon} first and last moment of the fiscal year */
    public static function range(Company $company, int $year): array
    {
        $start = Carbon::create($year, self::startMonth($company), 1)->startOfDay();

        return [$start, $start->copy()->addMonthsNoOverflow(12)->subSecond()];
    }

    /** "FY 2026", or "FY 2026–27" when the year doesn't start in January. */
    public static function label(Company $company, int $year): string
    {
        return self::startMonth($company) === 1 ? "FY {$year}" : 'FY '.$year.'–'.substr((string) ($year + 1), -2);
    }

    /** How much of the fiscal year has passed, 0–100 (whole percent). */
    public static function elapsedPct(Company $company, int $year): int
    {
        [$start, $end] = self::range($company, $year);
        $now = Carbon::now();
        if ($now->lt($start)) {
            return 0;
        }
        if ($now->gt($end)) {
            return 100;
        }

        return (int) floor($start->diffInSeconds($now) / $start->diffInSeconds($end) * 100);
    }
}
