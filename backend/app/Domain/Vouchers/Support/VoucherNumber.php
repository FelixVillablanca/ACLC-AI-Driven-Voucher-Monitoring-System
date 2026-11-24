<?php

namespace App\Domain\Vouchers\Support;

use App\Models\Company;
use App\Models\Voucher;
use Illuminate\Support\Str;

/**
 * Voucher numbers.
 *   Draft:     "DRAFT-9F3K…" (temporary; the column must be unique and not empty). Screens show "no number yet".
 *   Submitted: "{PREFIX}-{YEAR}-{0001}", one series per prefix per year, given at the FIRST submit and kept
 *              after that (a returned voucher keeps its number). PREFIX = the company's initials, up to 3
 *              letters ("Apex Holdings Inc." → AHI, "Northfield" → NOR).
 * The company row is LOCKED while the next number is worked out, so two clerks submitting at the same
 * moment can't get the same number (and the unique index would refuse it anyway).
 * Must be called inside a DB transaction.
 */
final class VoucherNumber
{
    public static function draft(): string
    {
        return 'DRAFT-'.Str::upper(Str::random(16));
    }

    public static function isDraft(?string $number): bool
    {
        return $number === null || str_starts_with($number, 'DRAFT-');
    }

    public static function next(Company $company): string
    {
        Company::whereKey($company->id)->lockForUpdate()->first();

        $base = self::prefix($company->name).'-'.now()->year.'-';
        // all vouchers with this prefix, not just this company's: two companies with the same initials
        // (e.g. "Apex Holdings Inc." and "Asia Home Inc.") then share one series and never clash
        $last = Voucher::query()
            ->where('voucher_number', 'like', $base.'%')
            ->orderByDesc('voucher_number')
            ->value('voucher_number');

        $next = $last ? ((int) substr($last, strlen($base))) + 1 : 1;

        return $base.str_pad((string) $next, 4, '0', STR_PAD_LEFT);
    }

    public static function prefix(string $name): string
    {
        $words = preg_split('/\s+/', trim(preg_replace('/[^\p{L}\p{N}\s]/u', ' ', $name)), -1, PREG_SPLIT_NO_EMPTY);
        if (count($words) === 1) {
            return Str::upper(Str::substr(Str::ascii($words[0]), 0, 3)) ?: 'VCH';
        }

        return Str::upper(collect($words)->take(3)->map(fn ($w) => Str::substr(Str::ascii($w), 0, 1))->join('')) ?: 'VCH';
    }
}
