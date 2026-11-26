<?php

namespace App\Domain\Vouchers\Support;

use App\Models\Voucher;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Drafts are deleted after 30 days without a change (user decision 2026-11-25). Any save, including the
 * form's auto-save, moves `updated_at` and so restarts the clock. The clerk is reminded 3 days before.
 * Only true drafts expire: never-submitted (status draft, still a DRAFT-… number). Returned vouchers don't.
 */
final class DraftExpiry
{
    public const DAYS = 30;

    public const WARN_DAYS = 3;

    public static function expiresAt(Voucher $voucher): ?Carbon
    {
        return self::isExpiring($voucher) ? $voucher->updated_at?->copy()->addDays(self::DAYS) : null;
    }

    public static function isExpiring(Voucher $voucher): bool
    {
        return $voucher->status === 'draft' && VoucherNumber::isDraft($voucher->voucher_number);
    }

    /** Drafts that may expire (status draft, never numbered). */
    public static function scope($query)
    {
        return $query->where('status', 'draft')->where('voucher_number', 'like', 'DRAFT-%');
    }

    /** The line count of each voucher, for VoucherCompleteness, without loading the lines. */
    public static function lineCountColumn(): array
    {
        return ['line_count' => DB::table('voucher_line_items')->selectRaw('COUNT(*)')->whereColumn('voucher_line_items.voucher_id', 'vouchers.id')];
    }
}
