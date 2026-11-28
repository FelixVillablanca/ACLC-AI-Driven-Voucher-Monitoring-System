<?php

namespace App\Domain\Vouchers\Cheques;

use App\Models\Cheque;
use Illuminate\Support\Carbon;

/**
 * THE cheque rules (user decisions 2026-11-29), shared by the actions, the register and the screens.
 *
 *   issued ──release──▶ released ──clear──▶ cleared
 *     │                    │
 *     └──cancel──▶ cancelled ◀──cancel──┘
 *   issued / released ──(daily job, 180 days after the cheque date)──▶ stale
 *
 * A STATE MACHINE: each status lists the statuses it may move to, so no screen or request can skip a step
 * (a cleared cheque can't be cancelled, a cancelled one can't be released).
 * LIVE statuses block a second cheque for the same voucher; after cancelled / stale a replacement may be recorded.
 */
final class ChequeRules
{
    /** A Philippine cheque is usually stale six months after its date. */
    public const STALE_DAYS = 180;

    /** The clerk is reminded this many days before. */
    public const WARN_DAYS = 30;

    /** A post-dated cheque may be dated at most this far ahead. */
    public const MAX_DAYS_AHEAD = 180;

    public const LIVE = ['issued', 'released', 'cleared'];

    /** Not paid yet: still counts as money going out. */
    public const OUTSTANDING = ['issued', 'released'];

    public const STATUSES = ['issued', 'released', 'cleared', 'stale', 'cancelled'];

    public const LABELS = [
        'issued' => 'Issued', 'released' => 'Released', 'cleared' => 'Cleared', 'stale' => 'Stale', 'cancelled' => 'Cancelled',
    ];

    /** What a person may do next (stale is only set by the daily job). */
    public const NEXT = [
        'issued' => ['released', 'cancelled'],
        'released' => ['cleared', 'cancelled'],
        'cleared' => [],
        'stale' => [],
        'cancelled' => [],
    ];

    public static function can(Cheque $cheque, string $to): bool
    {
        return in_array($to, self::NEXT[$cheque->status] ?? [], true);
    }

    /** The day the cheque goes stale. */
    public static function staleOn(Carbon $chequeDate): Carbon
    {
        return $chequeDate->copy()->addDays(self::STALE_DAYS);
    }

    /** Whole days until it goes stale (negative = past), only for outstanding cheques. */
    public static function daysLeft(Cheque $cheque): ?int
    {
        if (! in_array($cheque->status, self::OUTSTANDING, true)) {
            return null;
        }

        return (int) Carbon::today()->diffInDays(self::staleOn($cheque->cheque_date), false);
    }
}
