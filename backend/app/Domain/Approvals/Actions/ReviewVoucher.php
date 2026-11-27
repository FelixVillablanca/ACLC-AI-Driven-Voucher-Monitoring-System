<?php

namespace App\Domain\Approvals\Actions;

use App\Domain\Approvals\Support\ApprovalRoute;
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
use Throwable;

/**
 * Accounting Officer, step 1 (Framer jQfdHPifl review, pzSaaMGhY approve, XT9f8T3lY return, sozCOjfDk reject).
 * Each decision is ONE transaction: the voucher row is locked, it must still be `pending` (else 409
 * VOUCHER_ALREADY_REVIEWED: another officer was faster), a voucher_approvals row + an audit row are written,
 * the status moves through TransitionVoucher's ALLOWED map, and the clerk gets a bell notice.
 *   approve → approved, or under_review when ApprovalRoute says step 2 (then the Supervisors are notified);
 *             a FINAL approval adds the amount to the department's yearly budget (ConsumeBudget)
 *   return  → returned, with what needs changes + remarks (clerk also emailed)
 *   reject  → rejected (closed), with a reason + remarks (clerk also emailed)
 * Segregation of duties: nobody reviews a voucher they created (403 SELF_REVIEW).
 */
class ReviewVoucher
{
    public function __construct(private TransitionVoucher $transition, private ApprovalRoute $route, private ConsumeBudget $budget) {}

    /** @return array{voucher: Voucher, forwarded: bool, supervisors: list<string>} */
    public function approve(int $voucherId, User $officer, Company $company, ?string $remarks, ?string $ip = null, ?string $finding = null): array
    {
        $result = DB::transaction(fn () => $this->approveLocked($voucherId, $officer, $company, $remarks, $ip, false, $finding));
        $this->notifyAfterApproval([$result], $officer, $company);

        return $result;
    }

    /**
     * Bulk approve (frame vZeEe5_Hq): up to 50 at once, all or nothing. AI-flagged vouchers can't be
     * bulk-approved (each needs its own look): 409 BULK_NOT_ALLOWED lists them.
     *
     * @param  list<int>  $ids
     * @return list<array{voucher: Voucher, forwarded: bool, supervisors: list<string>}>
     */
    public function approveMany(array $ids, User $officer, Company $company, ?string $ip = null): array
    {
        $results = DB::transaction(function () use ($ids, $officer, $company, $ip) {
            $rows = Voucher::query()->whereIn('id', $ids)->where('company_id', $company->id)->orderBy('id')->lockForUpdate()->get();
            if ($rows->count() !== count(array_unique($ids))) {
                throw new ApiException('Some of these vouchers aren’t in this company’s queue any more. Reload the queue.', 'BULK_NOT_ALLOWED', 409);
            }
            $blocked = $rows->filter(fn (Voucher $v) => $v->status !== S::Pending->value || $v->ai_anomaly_flag || (int) $v->created_by === (int) $officer->id);
            if ($blocked->isNotEmpty()) {
                throw new ApiException(
                    'These can’t be bulk-approved (already reviewed, AI-flagged or your own): '.$blocked->pluck('voucher_number')->implode(', ').'. Review them one by one.',
                    'BULK_NOT_ALLOWED', 409);
            }

            return $rows->map(fn (Voucher $v) => $this->approveLocked($v->id, $officer, $company, null, $ip, bulk: true))->all();
        });
        $this->notifyAfterApproval($results, $officer, $company);

        return $results;
    }

    /** @param list<string> $needsChanges */
    public function returnToClerk(int $voucherId, User $officer, Company $company, array $needsChanges, string $remarks, ?string $ip = null, ?string $finding = null): Voucher
    {
        $voucher = DB::transaction(function () use ($voucherId, $officer, $company, $needsChanges, $remarks, $ip, $finding) {
            $voucher = $this->lockPending($voucherId, $officer, $company, S::Returned->value);
            $this->recordFinding($voucher, $officer, $finding);
            $this->record($voucher, $officer, 'returned', $remarks, $needsChanges);
            $voucher->forceFill(['status' => S::Returned->value])->save();
            $this->transition->audit($officer, 'voucher_returned', $voucher, S::Pending->value, $ip, ['step' => 1, 'needs_changes' => $needsChanges]);

            Notification::create([
                'recipient_id' => $voucher->created_by,
                'type' => 'voucher_returned',
                'title' => "{$voucher->voucher_number} was sent back to you",
                'message' => "{$officer->full_name} (Accounting): ".implode(', ', ReviewOptions::labels($needsChanges)).'. “'.mb_strimwidth($remarks, 0, 160, '…').'”',
                'voucher_id' => $voucher->id,
            ]);

            return $voucher;
        });
        $this->emailClerk($voucher, $officer, $company, 'returned', $remarks, ReviewOptions::labels($needsChanges));

        return $voucher;
    }

    public function reject(int $voucherId, User $officer, Company $company, string $reason, string $remarks, ?string $ip = null): Voucher
    {
        $voucher = DB::transaction(function () use ($voucherId, $officer, $company, $reason, $remarks, $ip) {
            $voucher = $this->lockPending($voucherId, $officer, $company, S::Rejected->value);
            $this->record($voucher, $officer, 'rejected', $remarks, null, $reason);
            $voucher->forceFill(['status' => S::Rejected->value])->save();
            $this->transition->audit($officer, 'voucher_rejected', $voucher, S::Pending->value, $ip, ['step' => 1, 'reason' => $reason]);

            Notification::create([
                'recipient_id' => $voucher->created_by,
                'type' => 'voucher_rejected',
                'title' => "{$voucher->voucher_number} was rejected",
                'message' => "{$officer->full_name} (Accounting): ".ReviewOptions::REJECT_REASONS[$reason].'. “'.mb_strimwidth($remarks, 0, 160, '…').'”',
                'voucher_id' => $voucher->id,
            ]);

            return $voucher;
        });
        $this->emailClerk($voucher, $officer, $company, 'rejected', $remarks, [], ReviewOptions::REJECT_REASONS[$reason]);

        return $voucher;
    }

    /** @return array{voucher: Voucher, forwarded: bool, supervisors: list<string>} */
    private function approveLocked(int $voucherId, User $officer, Company $company, ?string $remarks, ?string $ip, bool $bulk = false, ?string $finding = null): array
    {
        $voucher = $this->lockPending($voucherId, $officer, $company, S::Approved->value);
        $this->recordFinding($voucher, $officer, $finding);
        $reasons = $this->route->step2Reasons($voucher);
        $forward = $reasons !== [];
        $supervisors = $forward ? ApprovalRoute::supervisorsOf($company) : collect();

        $this->record($voucher, $officer, 'approved', $remarks);
        $voucher->forceFill($forward
            ? ['status' => S::UnderReview->value]
            : ['status' => S::Approved->value, 'approved_at' => now()])->save();
        if (! $forward) {
            $this->budget->consume($voucher, $company); // final approval: the department's budget is used (row locked)
        }
        $this->transition->audit($officer, 'voucher_approved', $voucher, S::Pending->value, $ip,
            ['step' => 1, 'forwarded_to_step2' => $forward, 'step2_reasons' => $reasons] + ($bulk ? ['bulk' => true] : []));

        return ['voucher' => $voucher, 'forwarded' => $forward, 'supervisors' => $supervisors->map(fn ($s) => $s->full_name)->all(), 'supervisor_ids' => $supervisors->pluck('id')->all(), 'remarks' => $remarks];
    }

    /**
     * Flagged vouchers (Framer YX1IiDXMp): "False alarm" = the flag is cleared and the voucher goes on as a
     * normal one (no Supervisor step because of the flag). The score and signals are kept for the record and
     * for Phase 5 to learn from. 409 FLAG_ALREADY_REVIEWED when it isn't flagged (any more).
     */
    public function markNormal(int $voucherId, User $officer, Company $company, ?string $note, ?string $ip = null): Voucher
    {
        return DB::transaction(function () use ($voucherId, $officer, $company, $note, $ip) {
            $voucher = $this->lockPending($voucherId, $officer, $company, S::Approved->value);
            if (! $voucher->ai_anomaly_flag) {
                throw new ApiException("{$voucher->voucher_number} isn't flagged any more (someone already cleared it).", 'FLAG_ALREADY_REVIEWED', 409);
            }
            $voucher->forceFill([
                'ai_anomaly_flag' => false,
                'ai_review_finding' => 'false_alarm',
                'ai_reviewed_by' => $officer->id,
                'ai_reviewed_at' => now(),
            ])->saveQuietly();
            $this->transition->audit($officer, 'voucher_flag_cleared', $voucher, $voucher->status, $ip,
                ['score' => (string) $voucher->ai_anomaly_score, 'reason' => $voucher->ai_anomaly_reason, 'note' => $note]);

            return $voucher;
        });
    }

    /** "Valid but high" (approved anyway) / "Needs changes" (returned): saved with the decision, flagged vouchers only. */
    private function recordFinding(Voucher $voucher, User $officer, ?string $finding): void
    {
        if ($finding && $voucher->ai_anomaly_flag) {
            $voucher->forceFill(['ai_review_finding' => $finding, 'ai_reviewed_by' => $officer->id, 'ai_reviewed_at' => now()]);
        }
    }

    /** Locked, in this company, still waiting for step 1, and not the officer's own voucher. */
    private function lockPending(int $voucherId, User $officer, Company $company, string $to): Voucher
    {
        /** @var Voucher $voucher */
        $voucher = Voucher::query()->where('company_id', $company->id)->whereKey($voucherId)->lockForUpdate()->firstOrFail();

        if ((int) $voucher->created_by === (int) $officer->id) {
            throw new ApiException('You can’t review a voucher you created (segregation of duties).', 'SELF_REVIEW', 403);
        }
        if ($voucher->status !== S::Pending->value) {
            $now = match ($voucher->status) {
                S::UnderReview->value => 'approved and is with the Supervisor',
                S::Approved->value => 'approved',
                S::Returned->value => 'sent back to the clerk',
                S::Rejected->value => 'rejected',
                S::Cancelled->value => 'cancelled by the clerk',
                default => 'changed',
            };
            throw new ApiException("{$voucher->voucher_number} was already {$now}, so there’s nothing to decide. It’s been taken off your queue.", 'VOUCHER_ALREADY_REVIEWED', 409);
        }

        return $this->transition->lock($voucher, $to);
    }

    /** @param list<string>|null $needsChanges */
    private function record(Voucher $voucher, User $officer, string $action, ?string $remarks, ?array $needsChanges = null, ?string $reason = null): void
    {
        DB::table('voucher_approvals')->insert([
            'voucher_id' => $voucher->id,
            'approver_id' => $officer->id,
            'step' => 1,
            'role_at_time' => 'accounting_officer',
            'action' => $action,
            'remarks' => $remarks,
            'needs_changes' => $needsChanges ? json_encode(array_values($needsChanges)) : null,
            'reason' => $reason,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    /** Bell notices after the commit: the clerk (approved / forwarded) and, when forwarded, the Supervisors. */
    private function notifyAfterApproval(array $results, User $officer, Company $company): void
    {
        foreach ($results as $r) {
            $v = $r['voucher'];
            Notification::create([
                'recipient_id' => $v->created_by,
                'type' => 'voucher_approved',
                'title' => $r['forwarded'] ? "{$v->voucher_number} passed Accounting" : "{$v->voucher_number} was approved",
                'message' => $r['forwarded']
                    ? "{$officer->full_name} approved it; it now needs the Supervisor / Manager’s final approval."
                    : "{$officer->full_name} (Accounting) approved it in {$company->name}.",
                'voucher_id' => $v->id,
            ]);
            foreach ($r['supervisor_ids'] as $id) {
                Notification::create([
                    'recipient_id' => $id,
                    'type' => 'voucher_pending',
                    'title' => "Final approval needed: {$v->voucher_number}",
                    'message' => "{$officer->full_name} (Accounting) approved it in {$company->name}".($r['remarks'] ? '. Note: “'.mb_strimwidth($r['remarks'], 0, 160, '…').'”' : '.'),
                    'voucher_id' => $v->id,
                ]);
            }
        }
    }

    private function emailClerk(Voucher $voucher, User $officer, Company $company, string $decision, string $remarks, array $labels = [], ?string $reason = null): void
    {
        $clerk = User::find($voucher->created_by);
        if (! $clerk) {
            return;
        }
        try {
            $link = rtrim((string) config('app.frontend_url'), '/')."/clerk/vouchers/{$voucher->id}";
            Mail::to($clerk->personal_email ?: $clerk->email)
                ->send(new VoucherDecisionMail($clerk, $officer, $company, $voucher, $decision, $remarks, $labels, $reason, $link));
        } catch (Throwable $e) {
            Log::warning('Voucher decision email failed', ['voucher' => $voucher->id, 'error' => $e->getMessage()]);
        }
    }
}
