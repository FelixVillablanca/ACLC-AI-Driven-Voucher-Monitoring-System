<?php

namespace App\Domain\Approvals\Actions;

use App\Domain\Approvals\Support\ReviewOptions;
use App\Domain\Budgets\Actions\ConsumeBudget;
use App\Domain\Vouchers\Actions\TransitionVoucher;
use App\Domain\Vouchers\VoucherStatus as S;
use App\Exceptions\ApiException;
use App\Mail\VoucherDecisionMail;
use App\Models\Company;
use App\Models\Notification;
use App\Models\User;
use App\Models\Voucher;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\ValidationException;
use Throwable;

/**
 * The Supervisor / Manager's Level 2 decision (2026-11-27; Framer Nl0dfYkY_ final review, WQL6Ca1ML approve,
 * PlbU6CVEj return, tW_30cpOE reject). Each decision is ONE transaction: the voucher row is locked, it must still
 * be `under_review` (else 409 VOUCHER_ALREADY_REVIEWED), a voucher_approvals row (step 2) + an audit row are
 * written, the status moves through TransitionVoucher's ALLOWED map, and the people involved get bell notices.
 *   approve  → approved (FINAL: approved_at, the department's budget is used, ConsumeBudget). A flagged voucher
 *              needs remarks (the Supervisor overrides the flag on the record).
 *   return   → to the CLERK (returned: they fix + resubmit, it goes through Level 1 again) or to ACCOUNTING
 *              (pending: back in the officers' queue). voucher_approvals.reason = 'to_clerk' | 'to_accounting'.
 *   reject   → rejected (closed), reason + remarks.
 * Nobody decides on a voucher they created (403 SELF_REVIEW). The clerk is emailed on return-to-clerk / reject.
 */
class FinalReview
{
    public const RETURN_TO = ['clerk', 'accounting'];

    public function __construct(private TransitionVoucher $transition, private ConsumeBudget $budget) {}

    public function approve(int $voucherId, User $by, Company $company, ?string $remarks, ?string $ip = null): Voucher
    {
        $voucher = DB::transaction(fn () => $this->approveLocked($voucherId, $by, $company, $remarks, $ip));
        $this->notifyApproved([$voucher], $by, $company);

        return $voucher;
    }

    /**
     * Approve several at once (Framer "Approve selected"), all or nothing, up to 50. Flagged vouchers can't be
     * bulk-approved (each needs its own look and remarks): 409 BULK_NOT_ALLOWED.
     *
     * @param  list<int>  $ids
     * @return list<Voucher>
     */
    public function approveMany(array $ids, User $by, Company $company, ?string $ip = null): array
    {
        $vouchers = DB::transaction(function () use ($ids, $by, $company, $ip) {
            $rows = Voucher::query()->whereIn('id', $ids)->where('company_id', $company->id)->orderBy('id')->lockForUpdate()->get();
            if ($rows->count() !== count(array_unique($ids))) {
                throw new ApiException('Some of these vouchers aren’t in this company’s queue any more. Reload the queue.', 'BULK_NOT_ALLOWED', 409);
            }
            $blocked = $rows->filter(fn (Voucher $v) => $v->status !== S::UnderReview->value || $v->ai_anomaly_flag || (int) $v->created_by === (int) $by->id);
            if ($blocked->isNotEmpty()) {
                throw new ApiException(
                    'These can’t be bulk-approved (already decided, flagged or your own): '.$blocked->pluck('voucher_number')->implode(', ').'. Open them one by one.',
                    'BULK_NOT_ALLOWED', 409);
            }

            return $rows->map(fn (Voucher $v) => $this->approveLocked($v->id, $by, $company, null, $ip, bulk: true))->all();
        });
        $this->notifyApproved($vouchers, $by, $company);

        return $vouchers;
    }

    /** @param list<string> $needsChanges */
    public function returnVoucher(int $voucherId, User $by, Company $company, string $to, array $needsChanges, string $remarks, ?string $ip = null): Voucher
    {
        $toClerk = $to === 'clerk';
        $voucher = DB::transaction(function () use ($voucherId, $by, $company, $toClerk, $needsChanges, $remarks, $ip) {
            $voucher = $this->lockLevel2($voucherId, $by, $company, $toClerk ? S::Returned->value : S::Pending->value);
            $this->record($voucher, $by, 'returned', $remarks, $needsChanges, $toClerk ? 'to_clerk' : 'to_accounting');
            $voucher->forceFill(['status' => $toClerk ? S::Returned->value : S::Pending->value])->save();
            $this->transition->audit($by, 'voucher_returned', $voucher, S::UnderReview->value, $ip,
                ['step' => 2, 'to' => $toClerk ? 'clerk' : 'accounting', 'needs_changes' => $needsChanges]);

            $labels = implode(', ', ReviewOptions::labels($needsChanges));
            $quote = '“'.mb_strimwidth($remarks, 0, 160, '…').'”';
            if ($toClerk) {
                $this->notify($voucher->created_by, 'voucher_returned', "{$voucher->voucher_number} was sent back to you",
                    "{$by->full_name} (Supervisor / Manager): {$labels}. {$quote}", $voucher);
            }
            foreach ($this->level1Approvers($voucher) as $id) {
                $this->notify($id, 'voucher_returned',
                    $toClerk ? "{$voucher->voucher_number} was returned to the clerk" : "{$voucher->voucher_number} is back with Accounting",
                    "{$by->full_name} (Supervisor / Manager) returned it ".($toClerk ? 'to the clerk' : 'to Accounting').": {$labels}. {$quote}", $voucher);
            }

            return $voucher;
        });
        if ($toClerk) {
            $this->emailClerk($voucher, $by, $company, 'returned', $remarks, ReviewOptions::labels($needsChanges));
        }

        return $voucher;
    }

    public function reject(int $voucherId, User $by, Company $company, string $reason, string $remarks, ?string $ip = null): Voucher
    {
        $voucher = DB::transaction(function () use ($voucherId, $by, $company, $reason, $remarks, $ip) {
            $voucher = $this->lockLevel2($voucherId, $by, $company, S::Rejected->value);
            $this->record($voucher, $by, 'rejected', $remarks, null, $reason);
            $voucher->forceFill(['status' => S::Rejected->value])->save();
            $this->transition->audit($by, 'voucher_rejected', $voucher, S::UnderReview->value, $ip, ['step' => 2, 'reason' => $reason]);

            $message = "{$by->full_name} (Supervisor / Manager): ".ReviewOptions::REJECT_REASONS[$reason].'. “'.mb_strimwidth($remarks, 0, 160, '…').'”';
            $this->notify($voucher->created_by, 'voucher_rejected', "{$voucher->voucher_number} was rejected", $message, $voucher);
            foreach ($this->level1Approvers($voucher) as $id) {
                $this->notify($id, 'voucher_rejected', "{$voucher->voucher_number} was rejected at Level 2", $message, $voucher);
            }

            return $voucher;
        });
        $this->emailClerk($voucher, $by, $company, 'rejected', $remarks, [], ReviewOptions::REJECT_REASONS[$reason]);

        return $voucher;
    }

    private function approveLocked(int $voucherId, User $by, Company $company, ?string $remarks, ?string $ip, bool $bulk = false): Voucher
    {
        $voucher = $this->lockLevel2($voucherId, $by, $company, S::Approved->value);
        if ($voucher->ai_anomaly_flag && blank($remarks)) {
            throw ValidationException::withMessages(['remarks' => 'This voucher is flagged: say why you approve it anyway (it’s saved to the audit trail).']);
        }
        $this->record($voucher, $by, 'approved', $remarks);
        $voucher->forceFill(['status' => S::Approved->value, 'approved_at' => now()])->save();
        $this->budget->consume($voucher, $company); // final approval: the department's budget is used (row locked)
        $this->transition->audit($by, 'voucher_approved', $voucher, S::UnderReview->value, $ip,
            ['step' => 2, 'final' => true, 'overrode_flag' => (bool) $voucher->ai_anomaly_flag] + ($bulk ? ['bulk' => true] : []));

        return $voucher;
    }

    /** Locked, in this company, still waiting for Level 2, and not the Supervisor's own voucher. */
    private function lockLevel2(int $voucherId, User $by, Company $company, string $to): Voucher
    {
        /** @var Voucher $voucher */
        $voucher = Voucher::query()->where('company_id', $company->id)->whereKey($voucherId)->lockForUpdate()->firstOrFail();

        if ((int) $voucher->created_by === (int) $by->id) {
            throw new ApiException('You can’t decide on a voucher you created (segregation of duties).', 'SELF_REVIEW', 403);
        }
        if ($voucher->status !== S::UnderReview->value) {
            $now = match ($voucher->status) {
                S::Approved->value => 'given its final approval',
                S::Rejected->value => 'rejected',
                S::Returned->value => 'sent back to the clerk',
                S::Pending->value => 'sent back to Accounting',
                default => 'changed',
            };
            throw new ApiException("{$voucher->voucher_number} was already {$now}, so there’s nothing to decide. It’s been taken off your queue.", 'VOUCHER_ALREADY_REVIEWED', 409);
        }

        return $this->transition->lock($voucher, $to);
    }

    /** @param list<string>|null $needsChanges */
    private function record(Voucher $voucher, User $by, string $action, ?string $remarks, ?array $needsChanges = null, ?string $reason = null): void
    {
        DB::table('voucher_approvals')->insert([
            'voucher_id' => $voucher->id,
            'approver_id' => $by->id,
            'step' => 2,
            'role_at_time' => 'supervisor_manager',
            'action' => $action,
            'remarks' => $remarks,
            'needs_changes' => $needsChanges ? json_encode(array_values($needsChanges)) : null,
            'reason' => $reason,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    /** @return list<int> who approved this voucher at Level 1 (the latest round) */
    private function level1Approvers(Voucher $voucher): array
    {
        $id = DB::table('voucher_approvals')->where('voucher_id', $voucher->id)->where('step', 1)->where('action', 'approved')
            ->orderByDesc('id')->value('approver_id');

        return $id ? [(int) $id] : [];
    }

    private function notify(int $recipient, string $type, string $title, string $message, Voucher $voucher): void
    {
        Notification::create(['recipient_id' => $recipient, 'type' => $type, 'title' => $title, 'message' => $message, 'voucher_id' => $voucher->id]);
    }

    /** @param list<Voucher> $vouchers */
    private function notifyApproved(array $vouchers, User $by, Company $company): void
    {
        foreach ($vouchers as $v) {
            $this->notify($v->created_by, 'voucher_approved', "{$v->voucher_number} was approved",
                "{$by->full_name} (Supervisor / Manager) gave the final approval in {$company->name}.", $v);
            foreach ($this->level1Approvers($v) as $id) {
                $this->notify($id, 'voucher_approved', "{$v->voucher_number} got its final approval",
                    "{$by->full_name} (Supervisor / Manager) approved it at Level 2.", $v);
            }
        }
    }

    private function emailClerk(Voucher $voucher, User $by, Company $company, string $decision, string $remarks, array $labels = [], ?string $reason = null): void
    {
        $clerk = User::find($voucher->created_by);
        if (! $clerk) {
            return;
        }
        try {
            $link = rtrim((string) config('app.frontend_url'), '/')."/clerk/vouchers/{$voucher->id}";
            Mail::to($clerk->personal_email ?: $clerk->email)
                ->send(new VoucherDecisionMail($clerk, $by, $company, $voucher, $decision, $remarks, $labels, $reason, $link));
        } catch (Throwable $e) {
            Log::warning('Voucher decision email failed', ['voucher' => $voucher->id, 'error' => $e->getMessage()]);
        }
    }
}
