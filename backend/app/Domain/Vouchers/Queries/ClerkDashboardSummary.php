<?php

namespace App\Domain\Vouchers\Queries;

use App\Domain\Vouchers\VoucherStatus;
use App\Models\Company;
use App\Models\User;
use App\Models\Voucher;
use App\Models\VoucherApproval;
use Illuminate\Database\Eloquent\Builder;

/**
 * The Accounting Clerk's landing page (Framer LolF6YFo5): the clerk's OWN vouchers in the company
 * they're working in (X-Company-ID, checked by ResolveCompany). Counts and sums are done by the
 * database; money stays DECIMAL (sent as strings, never floats).
 *
 *   drafts            status draft (count + total)
 *   in_review         pending (with the Accounting Officer) + under_review (with the Supervisor)
 *   returned          status returned, with the reviewer's latest note (Needs your attention)
 *   approved_month    approved this calendar month (count + total), by approved_at
 *   recent            the 5 most recently changed
 */
class ClerkDashboardSummary
{
    public const RECENT = 5;

    public function get(User $clerk, Company $company): array
    {
        $mine = fn (): Builder => Voucher::query()->where('company_id', $company->id)->where('created_by', $clerk->id);
        $count = fn (array|string $status) => $mine()->whereIn('status', (array) $status)->count();
        $sum = fn (Builder $q) => (string) ($q->sum('amount') ?: '0.00');

        $monthStart = now()->startOfMonth();
        $approvedMonth = $mine()->where('status', VoucherStatus::Approved->value)->where('approved_at', '>=', $monthStart);

        return [
            'company' => ['id' => $company->id, 'name' => $company->name],
            'department' => $clerk->department?->name,
            'counts' => [
                'all' => $mine()->where('status', '!=', VoucherStatus::Cancelled->value)->count(),
                'drafts' => $count(VoucherStatus::Draft->value),
                'returned' => $count(VoucherStatus::Returned->value),
                'with_officer' => $count(VoucherStatus::Pending->value),
                'with_supervisor' => $count(VoucherStatus::UnderReview->value),
            ],
            'drafts_total' => $sum($mine()->where('status', VoucherStatus::Draft->value)),
            'approved_this_month' => [
                'count' => (clone $approvedMonth)->count(),
                'total' => $sum(clone $approvedMonth),
                'month' => $monthStart->toDateString(),
            ],
            'recent' => $mine()
                ->with('category:id,name')
                ->where('status', '!=', VoucherStatus::Cancelled->value)
                ->orderByDesc('updated_at')->orderByDesc('id')
                ->limit(self::RECENT)
                ->get()
                ->map(fn (Voucher $v) => $this->row($v))
                ->all(),
            'needs_attention' => $this->returned($mine()),
        ];
    }

    private function row(Voucher $v): array
    {
        return [
            'id' => $v->id,
            // a draft keeps a temporary number until it's submitted; the screen says "no number yet"
            'voucher_number' => $v->status === VoucherStatus::Draft->value ? null : $v->voucher_number,
            'payee_name' => $v->payee_name,
            'category' => $v->category?->name,
            'amount' => (string) $v->amount,
            'currency' => $v->currency,
            'status' => $v->status,
            'ai_flagged' => (bool) $v->ai_anomaly_flag,
            'updated_at' => $v->updated_at?->toIso8601String(),
        ];
    }

    /** Returned vouchers, newest first, each with the reviewer's latest "returned" note. */
    private function returned(Builder $mine): array
    {
        $vouchers = $mine->where('status', VoucherStatus::Returned->value)->orderByDesc('updated_at')->limit(5)->get();
        if ($vouchers->isEmpty()) {
            return [];
        }

        $notes = VoucherApproval::query()
            ->whereIn('voucher_id', $vouchers->pluck('id'))
            ->where('action', 'returned')
            ->whereIn('id', fn ($q) => $q->from('voucher_approvals')->selectRaw('MAX(id)')->where('action', 'returned')->groupBy('voucher_id'))
            ->with('approver:id,first_name,last_name')
            ->get()
            ->keyBy('voucher_id');

        return $vouchers->map(function (Voucher $v) use ($notes) {
            $note = $notes->get($v->id);

            return [
                'id' => $v->id,
                'voucher_number' => $v->voucher_number,
                'payee_name' => $v->payee_name,
                'returned_by' => $note?->approver?->full_name,
                'returned_by_role' => $note?->role_at_time,
                'remarks' => $note?->remarks,
                'returned_at' => ($note?->created_at ?? $v->updated_at)?->toIso8601String(),
            ];
        })->all();
    }
}
