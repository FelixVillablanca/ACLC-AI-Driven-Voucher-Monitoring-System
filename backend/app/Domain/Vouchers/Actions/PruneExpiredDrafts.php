<?php

namespace App\Domain\Vouchers\Actions;

use App\Domain\Vouchers\Support\DraftExpiry;
use App\Domain\Vouchers\Support\VoucherNumber;
use App\Models\Company;
use App\Models\Notification;
use App\Models\Voucher;
use Illuminate\Support\Facades\DB;

/**
 * The nightly draft clean-up (`php artisan vouchers:prune-drafts`, scheduled in routes/console.php).
 *   1. REMIND: a draft that will be deleted within 3 days gets one bell notice ("…will be deleted on Dec 2").
 *      Only once per version: if the clerk saves it, the clock restarts and a later reminder is allowed.
 *   2. DELETE: drafts untouched for 30 days. Each one is locked and checked again before deleting, so a draft
 *      saved a moment ago (e.g. by auto-save) is never removed. One audit row each (by "System") and one
 *      bell notice per clerk + company saying how many went.
 *
 * @return array{reminded: int, deleted: int}
 */
class PruneExpiredDrafts
{
    public function handle(): array
    {
        $cutoff = now()->subDays(DraftExpiry::DAYS);

        return ['reminded' => $this->remind($cutoff), 'deleted' => $this->delete($cutoff)];
    }

    private function remind($cutoff): int
    {
        $sent = 0;
        DraftExpiry::scope(Voucher::query())
            ->where('updated_at', '>', $cutoff)
            ->where('updated_at', '<=', $cutoff->copy()->addDays(DraftExpiry::WARN_DAYS))
            // not already reminded about THIS version of the draft
            ->whereNotExists(fn ($q) => $q->from('notifications')->whereColumn('notifications.voucher_id', 'vouchers.id')
                ->where('notifications.type', 'draft_expiry')->whereColumn('notifications.created_at', '>=', 'vouchers.updated_at'))
            ->orderBy('id')
            ->each(function (Voucher $draft) use (&$sent) {
                $company = Company::find($draft->company_id)?->name ?? 'your company';
                $when = DraftExpiry::expiresAt($draft);
                Notification::create([
                    'recipient_id' => $draft->created_by,
                    'type' => 'draft_expiry',
                    'title' => 'A draft will be deleted '.($when->isToday() ? 'today' : 'on '.$when->format('M j')),
                    'message' => sprintf('Your draft for %s in %s hasn’t changed in %d days. Open it and save, or submit it, to keep it.',
                        $draft->payee_name ?: 'an unnamed payee', $company, DraftExpiry::DAYS - DraftExpiry::WARN_DAYS),
                    'voucher_id' => $draft->id,
                ]);
                $sent++;
            });

        return $sent;
    }

    private function delete($cutoff): int
    {
        $deleted = [];
        $ids = DraftExpiry::scope(Voucher::query())->where('updated_at', '<=', $cutoff)->orderBy('id')->pluck('id');

        foreach ($ids as $id) {
            DB::transaction(function () use ($id, $cutoff, &$deleted) {
                $draft = Voucher::query()->whereKey($id)->addSelect(['vouchers.*'])->addSelect(DraftExpiry::lineCountColumn())
                    ->lockForUpdate()->first();
                // checked again under the lock: saved, submitted or deleted meanwhile → leave it
                if (! $draft || $draft->status !== 'draft' || ! VoucherNumber::isDraft($draft->voucher_number) || $draft->updated_at > $cutoff) {
                    return;
                }
                DeleteVoucherDrafts::forget($draft, null, 'voucher_draft_expired');
                $key = $draft->created_by.'|'.$draft->company_id;
                $deleted[$key] = ($deleted[$key] ?? 0) + 1;
            });
        }

        foreach ($deleted as $key => $count) {
            [$clerk, $companyId] = explode('|', $key);
            $company = Company::find($companyId)?->name ?? 'your company';
            Notification::create([
                'recipient_id' => (int) $clerk,
                'type' => 'draft_expiry',
                'title' => $count === 1 ? 'An old draft was deleted' : "{$count} old drafts were deleted",
                'message' => sprintf('%s in %s had no changes for %d days, so %s deleted as planned.',
                    $count === 1 ? 'One draft' : "{$count} drafts", $company, DraftExpiry::DAYS, $count === 1 ? 'it was' : 'they were'),
            ]);
        }

        return array_sum($deleted);
    }
}
