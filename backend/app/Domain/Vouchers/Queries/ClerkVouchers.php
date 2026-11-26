<?php

namespace App\Domain\Vouchers\Queries;

use App\Domain\Vouchers\Support\DraftExpiry;
use App\Domain\Vouchers\VoucherStatus;
use App\Models\Company;
use App\Models\User;
use App\Models\Voucher;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Query\Builder as QueryBuilder;
use Illuminate\Support\Facades\DB;

/**
 * A clerk's OWN vouchers in the company they're working in (X-Company-ID). Another clerk's voucher,
 * or one in another company, is 404 (find()), never "403 exists but not yours".
 *
 * Views (the tabs on My vouchers): draft · in_review (pending + under_review) · returned · approved ·
 * rejected · cancelled; none = everything except cancelled.
 */
class ClerkVouchers
{
    public const VIEWS = ['draft', 'in_review', 'returned', 'approved', 'rejected', 'cancelled'];

    /** returned_oldest / returned_recent = by when the reviewer sent it back (Returned to me), not by the last edit. */
    public const SORTS = ['recent', 'oldest', 'amount_desc', 'amount_asc', 'returned_oldest', 'returned_recent'];

    public function __construct(private User $clerk, private Company $company) {}

    public function base(): Builder
    {
        return Voucher::query()->where('company_id', $this->company->id)->where('created_by', $this->clerk->id);
    }

    public function list(?string $view, ?string $search, ?string $sort): Builder
    {
        $q = $this->filtered($view, $search)->with(['category:id,name', 'latestReturn.approver:id,first_name,last_name'])
            ->addSelect(['vouchers.*'])->addSelect(DraftExpiry::lineCountColumn());

        return match ($sort) {
            'oldest' => $q->orderBy('updated_at')->orderBy('id'),
            'amount_desc' => $q->orderByDesc('amount')->orderByDesc('id'),
            'amount_asc' => $q->orderBy('amount')->orderBy('id'),
            'returned_oldest' => $q->orderBy($this->returnedAt())->orderBy('id'),
            'returned_recent' => $q->orderByDesc($this->returnedAt())->orderByDesc('id'),
            default => $q->orderByDesc('updated_at')->orderByDesc('id'),
        };
    }

    /** When the voucher was last sent back (a subquery for ORDER BY). */
    private function returnedAt(): QueryBuilder
    {
        return DB::table('voucher_approvals')->selectRaw('MAX(created_at)')
            ->whereColumn('voucher_approvals.voucher_id', 'vouchers.id')->where('action', 'returned');
    }

    /** The total of everything the current tab + search match (Drafts footer: "₱ 48,250.00 not yet submitted"). */
    public function totalAmount(?string $view, ?string $search): string
    {
        return (string) $this->filtered($view, $search)->toBase()->selectRaw('COALESCE(SUM(amount), 0) as total')->value('total');
    }

    private function filtered(?string $view, ?string $search): Builder
    {
        $q = $this->base();

        match ($view) {
            'in_review' => $q->whereIn('status', VoucherStatus::inReview()),
            null, '' => $q->where('status', '!=', VoucherStatus::Cancelled->value),
            default => $q->where('status', $view),
        };

        if ($search) {
            $like = '%'.addcslashes($search, '\\%_').'%';
            $q->where(fn (Builder $w) => $w
                ->where('voucher_number', 'like', $like)
                ->orWhere('payee_name', 'like', $like)
                ->orWhere('description', 'like', $like)
                ->orWhere('purpose', 'like', $like)
                ->orWhere('reference_number', 'like', $like)
                // an amount typed as "18450" or "18,450.00"
                ->when(is_numeric($n = str_replace([',', '₱', ' '], '', $search)), fn ($x) => $x->orWhere('amount', $n)));
        }

        return $q;
    }

    /** The numbers on the tabs. */
    public function counts(): array
    {
        $rows = $this->base()->selectRaw('status, COUNT(*) as n')->groupBy('status')->pluck('n', 'status');
        $n = fn (string ...$s) => (int) collect($s)->sum(fn ($x) => $rows[$x] ?? 0);

        return [
            'all' => (int) $rows->except(VoucherStatus::Cancelled->value)->sum(),
            'draft' => $n('draft'),
            'in_review' => $n('pending', 'under_review'),
            'returned' => $n('returned'),
            'approved' => $n('approved'),
            'rejected' => $n('rejected'),
            'cancelled' => $n('cancelled'),
        ];
    }

    public function find(int $id): Voucher
    {
        return $this->base()->with(['category:id,name', 'latestReturn.approver:id,first_name,last_name'])->findOrFail($id);
    }
}
