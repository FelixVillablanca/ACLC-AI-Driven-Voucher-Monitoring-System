<?php

namespace App\Domain\Vouchers\Support;

use App\Models\Voucher;
use Illuminate\Support\Facades\DB;

/**
 * "Returned to me" (Framer xRM5FKjDQ list, EWrCKOIlI fix & resubmit, 2026-11-26): the reviewer's latest
 * send-back on a returned voucher: who, as which reviewer (step 1 Accounting / step 2 Supervisor), the
 * note and when. Uses Voucher::latestReturn (eager-loaded by ClerkVouchers).
 *
 * With $detailed, also what the total was when it came back, read from the audit trail: the first save
 * after the return records the old amount. No save since then = the total hasn't changed.
 */
final class ReturnNote
{
    /** @return array<string, mixed>|null */
    public static function for(Voucher $voucher, bool $detailed = false): ?array
    {
        if ($voucher->status !== 'returned' || ! ($note = $voucher->latestReturn)) {
            return null;
        }

        $info = [
            'step' => (int) $note->step,
            'role' => $note->role_at_time,
            'by' => $note->approver?->full_name,
            'remarks' => $note->remarks,
            'at' => $note->created_at?->toIso8601String(),
        ];

        if (! $detailed) {
            return $info;
        }

        $firstSave = DB::table('audit_logs')
            ->where('table_name', 'vouchers')->where('record_id', $voucher->id)->where('action', 'voucher_updated')
            ->where('created_at', '>=', $note->created_at)
            ->orderBy('id')->value('old_values');
        $old = $firstSave ? json_decode($firstSave, true) : null;

        return $info + [
            'edited_since' => $firstSave !== null,
            'amount_at_return' => (string) ($old['amount'] ?? $voucher->amount),
        ];
    }
}
