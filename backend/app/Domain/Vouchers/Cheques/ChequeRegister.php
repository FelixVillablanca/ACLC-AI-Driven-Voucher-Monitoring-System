<?php

namespace App\Domain\Vouchers\Cheques;

use App\Models\Cheque;
use App\Models\Company;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;

/**
 * The cheque register (2026-11-29): every cheque of the company in X-Company-ID.
 * A clerk sees the cheques of THEIR OWN vouchers (like every clerk list); Accounting Officers and Supervisors see the
 * whole company, read-only.
 *
 *   views    outstanding (issued + released) | all | issued | released | cleared | stale | cancelled
 *   search   cheque number, payee, voucher number
 *   sort     cheque_date (newest first, default) | -cheque_date reversed | amount | stale_soon
 */
final class ChequeRegister
{
    public const VIEWS = ['outstanding', 'all', 'issued', 'released', 'cleared', 'stale', 'cancelled'];

    public const SORTS = ['recent', 'oldest', 'amount_high', 'stale_soon'];

    public function __construct(private User $user, private Company $company) {}

    public function base(): Builder
    {
        $q = Cheque::query()->where('cheques.company_id', $this->company->id);

        if ($this->user->role === 'accounting_clerk') {
            $q->whereHas('voucher', fn (Builder $v) => $v->where('created_by', $this->user->id));
        }

        return $q;
    }

    /** @param  array{view?: ?string, search?: ?string, sort?: ?string}  $f */
    public function list(array $f): Builder
    {
        $q = $this->base()->with(['voucher:id,voucher_number,created_by', 'creator:id,first_name,last_name']);
        $view = $f['view'] ?? 'outstanding';

        if ($view === 'outstanding') {
            $q->whereIn('cheques.status', ChequeRules::OUTSTANDING);
        } elseif ($view !== 'all') {
            $q->where('cheques.status', $view);
        }

        if ($search = trim((string) ($f['search'] ?? ''))) {
            $like = '%'.addcslashes($search, '%_\\').'%';
            $q->where(fn (Builder $w) => $w->where('cheques.cheque_number', 'like', $like)
                ->orWhere('cheques.payee_name', 'like', $like)
                ->orWhereHas('voucher', fn (Builder $v) => $v->where('voucher_number', 'like', $like)));
        }

        match ($f['sort'] ?? 'recent') {
            'oldest' => $q->orderBy('cheques.cheque_date')->orderBy('cheques.id'),
            'amount_high' => $q->orderByDesc('cheques.amount')->orderByDesc('cheques.id'),
            // closest to going stale first (outstanding ones; others after them)
            'stale_soon' => $q->orderByRaw("CASE WHEN cheques.status IN ('issued','released') THEN 0 ELSE 1 END")
                ->orderBy('cheques.cheque_date')->orderBy('cheques.id'),
            default => $q->orderByDesc('cheques.cheque_date')->orderByDesc('cheques.id'),
        };

        return $q;
    }

    /** Numbers for the cards and the view tabs (always the whole scope, not the search). */
    public function summary(): array
    {
        $byStatus = $this->base()->toBase()
            ->selectRaw('cheques.status, COUNT(*) as n, COALESCE(SUM(cheques.amount), 0) as total')
            ->groupBy('cheques.status')->get()->keyBy('status');

        $count = fn (string $s) => (int) ($byStatus[$s]->n ?? 0);
        $total = fn (array $ss) => collect($ss)->reduce(fn (string $sum, string $s) => bcadd($sum, (string) ($byStatus[$s]->total ?? '0'), 2), '0.00');

        $warnFrom = Carbon::today()->subDays(ChequeRules::STALE_DAYS - ChequeRules::WARN_DAYS);

        return [
            'counts' => [
                'outstanding' => $count('issued') + $count('released'),
                'all' => $byStatus->sum('n'),
                'issued' => $count('issued'),
                'released' => $count('released'),
                'cleared' => $count('cleared'),
                'stale' => $count('stale'),
                'cancelled' => $count('cancelled'),
            ],
            'outstanding_total' => $total(ChequeRules::OUTSTANDING),
            'cleared_total' => $total(['cleared']),
            // outstanding and going stale within 30 days (or already past while the job hasn't run yet)
            'stale_soon' => $this->base()->whereIn('status', ChequeRules::OUTSTANDING)->whereDate('cheque_date', '<=', $warnFrom)->count(),
        ];
    }
}
