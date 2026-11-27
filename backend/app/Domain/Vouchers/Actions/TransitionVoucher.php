<?php

namespace App\Domain\Vouchers\Actions;

use App\Domain\Audit\AuditTrail;
use App\Domain\Vouchers\Support\VoucherCompleteness;
use App\Domain\Vouchers\Support\VoucherNumber;
use App\Domain\Vouchers\VoucherStatus as S;
use App\Exceptions\ApiException;
use App\Jobs\RunAnomalyCheck;
use App\Models\Company;
use App\Models\Notification;
use App\Models\User;
use App\Models\Voucher;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * THE STATE MACHINE: the only place a voucher's status changes (Engineering Plan "Voucher lifecycle").
 * Agreed 2026-11-22:
 *   draft ──submit──▶ pending (Accounting Officer, step 1) ──▶ under_review (Supervisor, step 2) ──▶ approved | rejected
 *   pending / under_review ──return──▶ returned ──submit (after fixing)──▶ pending
 *   draft / returned ──cancel──▶ cancelled
 * The clerk's two moves (submit, cancel) are here. The reviewers' moves (approve / return / reject, Phase 4,
 * 2026-11-26) live in Approvals\Actions\ReviewVoucher and use lock() + audit() from here, so the
 * ALLOWED map stays the one rule for every move.
 * An impossible move (e.g. submitting an approved voucher, or a double click) is 409 INVALID_TRANSITION.
 */
class TransitionVoucher
{
    /** from => the statuses it may move to */
    public const ALLOWED = [
        'draft' => ['pending', 'cancelled'],
        'returned' => ['pending', 'cancelled'],
        'pending' => ['under_review', 'approved', 'rejected', 'returned'],
        'under_review' => ['approved', 'rejected', 'returned'],
        'approved' => [],
        'rejected' => [],
        'cancelled' => [],
    ];

    /** Clerk: send a draft / returned voucher to the Accounting Officer. */
    public function submit(Voucher $voucher, User $clerk, Company $company, ?string $ip = null): Voucher
    {
        return DB::transaction(function () use ($voucher, $clerk, $company, $ip) {
            $voucher = $this->lock($voucher, S::Pending->value);
            $this->assertComplete($voucher);

            $from = $voucher->status;
            $firstTime = VoucherNumber::isDraft($voucher->voucher_number);
            $voucher->forceFill([
                'status' => S::Pending->value,
                'voucher_number' => $firstTime ? VoucherNumber::next($company) : $voucher->voucher_number,
                'submitted_at' => now(),
                // a (re)submitted voucher gets a fresh automatic check: forget the previous one and its review
                'ai_anomaly_flag' => false,
                'ai_anomaly_score' => null,
                'ai_anomaly_reason' => null,
                'ai_check_signals' => null,
                'ai_check_source' => null,
                'ai_checked_at' => null,
                'ai_review_finding' => null,
                'ai_reviewed_by' => null,
                'ai_reviewed_at' => null,
            ])->save();

            RunAnomalyCheck::dispatch($voucher->id)->afterCommit();

            $this->audit($clerk, 'voucher_submitted', $voucher, $from, $ip);

            // tell the Accounting Officers who work in this company
            User::query()->where('role', 'accounting_officer')->where('is_active', true)
                ->whereHas('accessibleCompanies', fn ($q) => $q->where('companies.id', $company->id)->where('user_company_access.granted_status', 'accepted'))
                ->pluck('id')
                ->each(fn (int $id) => Notification::create([
                    'recipient_id' => $id,
                    'type' => 'voucher_pending',
                    'title' => ($from === S::Returned->value ? 'Voucher resubmitted: ' : 'New voucher to review: ').$voucher->voucher_number,
                    'message' => "{$clerk->full_name} submitted {$voucher->voucher_number} in {$company->name}.",
                    'voucher_id' => $voucher->id,
                ]));

            return $voucher;
        });
    }

    /** Clerk: cancel a draft / returned voucher (it stays in the history as cancelled). */
    public function cancel(Voucher $voucher, User $clerk, ?string $ip = null): Voucher
    {
        return DB::transaction(function () use ($voucher, $clerk, $ip) {
            $voucher = $this->lock($voucher, S::Cancelled->value);
            $from = $voucher->status;
            $voucher->forceFill(['status' => S::Cancelled->value])->save();
            $this->audit($clerk, 'voucher_cancelled', $voucher, $from, $ip);

            return $voucher;
        });
    }

    /** Locks the row (inside the caller's transaction) and checks the move is allowed; 409 otherwise. */
    public function lock(Voucher $voucher, string $to): Voucher
    {
        /** @var Voucher $voucher */
        $voucher = Voucher::whereKey($voucher->id)->lockForUpdate()->firstOrFail();

        if (! in_array($to, self::ALLOWED[$voucher->status] ?? [], true)) {
            throw new ApiException(match ($voucher->status) {
                S::Pending->value, S::UnderReview->value => 'This voucher is already with a reviewer.',
                S::Cancelled->value => 'This voucher was cancelled.',
                default => 'This voucher is finished and can’t be changed.',
            }, 'INVALID_TRANSITION', 409);
        }

        return $voucher;
    }

    /** What a reviewer needs (the same rule the Drafts cards show). Errors use the form's field names. */
    private function assertComplete(Voucher $voucher): void
    {
        $lines = DB::table('voucher_line_items')->where('voucher_id', $voucher->id)->count();
        $errors = VoucherCompleteness::check($voucher, $lines)['errors'];

        if ($errors) {
            throw ValidationException::withMessages($errors);
        }
    }

    public function audit(User $by, string $action, Voucher $voucher, string $from, ?string $ip, array $extra = []): void
    {
        AuditTrail::record([
            'user_id' => $by->id,
            'company_id' => $voucher->company_id,
            'action' => $action,
            'table_name' => 'vouchers',
            'record_id' => $voucher->id,
            'old_values' => ['status' => $from],
            'new_values' => ['status' => $voucher->status, 'voucher_number' => $voucher->voucher_number] + $extra,
            'ip_address' => $ip,
        ]);
    }
}
