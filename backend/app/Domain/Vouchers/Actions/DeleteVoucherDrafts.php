<?php

namespace App\Domain\Vouchers\Actions;

use App\Domain\Audit\AuditTrail;
use App\Domain\Vouchers\Queries\ClerkVouchers;
use App\Domain\Vouchers\Support\DraftExpiry;
use App\Exceptions\ApiException;
use App\Models\User;
use App\Models\Voucher;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Support\Facades\DB;

/**
 * Delete drafts for good (Drafts page, Framer nxFtnDIl1; user decision 2026-11-25).
 * Only NEVER-submitted drafts: no reviewer has seen them and they have no number, so nothing in the
 * voucher history points at them. Returned vouchers keep Cancel instead.
 * All-or-nothing: if one of the chosen drafts can't be deleted, none are (409 DRAFT_NOT_DELETABLE).
 * The lines go with the voucher (ON DELETE CASCADE); bell notices that mention it lose the link (SET NULL).
 * One audit row per deleted draft (who, what it was) stays, so the deletion is never silent.
 */
class DeleteVoucherDrafts
{
    public const MAX = 50;

    /**
     * @param  list<int>  $ids
     * @param  ?string  $openedAt  one draft only: the `updated_at` the screen showed (409 VOUCHER_CHANGED if it moved)
     * @return int how many were deleted
     */
    public function delete(array $ids, ClerkVouchers $mine, User $clerk, ?string $openedAt = null, ?string $ip = null): int
    {
        $ids = array_values(array_unique(array_map('intval', $ids)));

        return DB::transaction(function () use ($ids, $mine, $clerk, $openedAt, $ip) {
            $drafts = $mine->base()->whereKey($ids)->addSelect(['vouchers.*'])->addSelect(DraftExpiry::lineCountColumn())
                ->lockForUpdate()->get();

            if ($drafts->count() !== count($ids)) {
                // one of them isn't this clerk's voucher in this company (or is already gone)
                throw (new ModelNotFoundException)->setModel(Voucher::class);
            }
            if ($drafts->contains(fn (Voucher $v) => ! DraftExpiry::isExpiring($v))) {
                throw new ApiException(count($ids) === 1
                    ? 'Only drafts that were never submitted can be deleted. Cancel this voucher instead.'
                    : 'Some of these are no longer drafts (submitted in another window?). Nothing was deleted.', 'DRAFT_NOT_DELETABLE', 409);
            }
            if ($openedAt !== null && $drafts->first()->updated_at?->toIso8601String() !== $openedAt) {
                throw new ApiException('This draft was changed in another window. Check it again before deleting.', 'VOUCHER_CHANGED', 409);
            }

            foreach ($drafts as $draft) {
                self::forget($draft, $clerk->id, 'voucher_draft_deleted', $ip);
            }

            return $drafts->count();
        });
    }

    /** Delete one draft + write its audit row. Also used by the nightly clean-up (no user). */
    public static function forget(Voucher $draft, ?int $by, string $action, ?string $ip = null): void
    {
        AuditTrail::record([
            'user_id' => $by,
            'company_id' => $draft->company_id,
            'action' => $action,
            'table_name' => 'vouchers',
            'record_id' => $draft->id,
            'old_values' => [
                'status' => $draft->status,
                'payee_name' => $draft->payee_name,
                'amount' => (string) $draft->amount,
                'line_items' => (int) ($draft->line_count ?? DB::table('voucher_line_items')->where('voucher_id', $draft->id)->count()),
                'created_by' => $draft->created_by,
                'last_changed' => $draft->updated_at?->toIso8601String(),
            ],
            'new_values' => null,
            'ip_address' => $ip,
        ]);

        $draft->delete();
    }
}
