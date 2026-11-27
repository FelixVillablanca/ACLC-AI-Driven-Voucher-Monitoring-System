<?php

namespace App\Domain\Approvals\Queries;

use App\Domain\Approvals\Support\ApprovalRoute;
use App\Domain\Budgets\Support\FiscalYear;
use App\Domain\Vouchers\VoucherStatus as S;
use App\Models\Company;
use App\Models\User;
use App\Models\Voucher;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

/**
 * The Accounting Officer's review queue (Framer vZeEe5_Hq) for the company in X-Company-ID:
 * every voucher waiting for step 1 (`pending`), oldest submission first.
 * Views (tabs): all · ai_flagged · high_value (≥ threshold) · near_sla (waited ≥ 75% of the review SLA) ·
 * resubmitted (came back after a return). Filters: department, amount range, search (number, payee, clerk).
 * "Waiting since" = submitted_at, which a resubmit moves, so a fixed voucher starts a new wait.
 */
class ReviewQueue
{
    public const VIEWS = ['ai_flagged', 'high_value', 'near_sla', 'resubmitted'];

    public const SORTS = ['oldest', 'newest', 'amount_desc', 'amount_asc'];

    public function __construct(private User $officer, private Company $company, private ApprovalRoute $route) {}

    public function base(): Builder
    {
        return Voucher::query()->where('vouchers.company_id', $this->company->id)->where('vouchers.status', S::Pending->value);
    }

    public function list(array $filters): Builder
    {
        $q = $this->filtered($filters)
            ->select('vouchers.*')
            ->addSelect([
                'clerk_first' => DB::table('users')->select('first_name')->whereColumn('users.id', 'vouchers.created_by'),
                'clerk_last' => DB::table('users')->select('last_name')->whereColumn('users.id', 'vouchers.created_by'),
                'department_name' => DB::table('departments')->select('name')->whereColumn('departments.id', 'vouchers.department_id'),
                'was_returned' => DB::table('voucher_approvals')->selectRaw('COUNT(*) > 0')
                    ->whereColumn('voucher_approvals.voucher_id', 'vouchers.id')->where('action', 'returned'),
            ])
            ->with('category:id,name');

        return match ($filters['sort'] ?? null) {
            'newest' => $q->orderByDesc('vouchers.submitted_at')->orderByDesc('vouchers.id'),
            'amount_desc' => $q->orderByDesc('vouchers.amount')->orderBy('vouchers.id'),
            'amount_asc' => $q->orderBy('vouchers.amount')->orderBy('vouchers.id'),
            default => $q->orderBy('vouchers.submitted_at')->orderBy('vouchers.id'),
        };
    }

    public function filtered(array $filters, bool $withView = true): Builder
    {
        $q = $this->base();

        if ($withView) {
            $this->view($q, $filters['view'] ?? null);
        }
        if (! empty($filters['department'])) {
            $filters['department'] === 'none' ? $q->whereNull('vouchers.department_id') : $q->where('vouchers.department_id', (int) $filters['department']);
        }
        if (isset($filters['amount_min']) && $filters['amount_min'] !== null) {
            $q->where('vouchers.amount', '>=', $filters['amount_min']);
        }
        if (isset($filters['amount_max']) && $filters['amount_max'] !== null) {
            $q->where('vouchers.amount', '<=', $filters['amount_max']);
        }
        if (! empty($filters['search'])) {
            $like = '%'.addcslashes($filters['search'], '\\%_').'%';
            $q->where(fn (Builder $w) => $w
                ->where('vouchers.voucher_number', 'like', $like)
                ->orWhere('vouchers.payee_name', 'like', $like)
                ->orWhereIn('vouchers.created_by', DB::table('users')->select('id')
                    ->where(fn ($u) => $u->where('first_name', 'like', $like)->orWhere('last_name', 'like', $like)
                        ->orWhereRaw("CONCAT(first_name, ' ', last_name) LIKE ?", [$like]))));
        }

        return $q;
    }

    private function view(Builder $q, ?string $view): void
    {
        match ($view) {
            'ai_flagged' => $q->where('vouchers.ai_anomaly_flag', true),
            'high_value' => $q->where('vouchers.amount', '>=', $this->route->threshold()),
            'near_sla' => $q->where('vouchers.submitted_at', '<=', $this->route->nearSlaSince()),
            'resubmitted' => $q->whereExists(fn ($e) => $e->from('voucher_approvals')
                ->whereColumn('voucher_approvals.voucher_id', 'vouchers.id')->where('action', 'returned')),
            default => null,
        };
    }

    /** The tab numbers (the other filters apply, the view doesn't) + the total amount waiting. */
    public function counts(array $filters): array
    {
        $count = function (?string $view) use ($filters) {
            $q = $this->filtered($filters, false);
            $this->view($q, $view);

            return $q->count();
        };

        return [
            'all' => $count(null),
            'ai_flagged' => $count('ai_flagged'),
            'high_value' => $count('high_value'),
            'near_sla' => $count('near_sla'),
            'resubmitted' => $count('resubmitted'),
        ];
    }

    public function totalAmount(array $filters): string
    {
        return (string) $this->filtered($filters)->toBase()->selectRaw('COALESCE(SUM(amount), 0) as t')->value('t');
    }

    /** Where this voucher sits in the whole queue (oldest first): "‹ 3 of 12 ›" on the review page. */
    public function position(int $voucherId): ?array
    {
        $ids = $this->base()->orderBy('submitted_at')->orderBy('id')->limit(1000)->pluck('id')->all();
        $i = array_search($voucherId, $ids, true);
        if ($i === false) {
            return null;
        }

        return ['index' => $i + 1, 'total' => count($ids), 'prev_id' => $ids[$i - 1] ?? null, 'next_id' => $ids[$i + 1] ?? null];
    }

    /** The first voucher to review ("Review next"), in the queue's default order. */
    public function nextId(): ?int
    {
        return $this->base()->orderBy('submitted_at')->orderBy('id')->value('id');
    }

    /**
     * Possible duplicates, by a plain rule (not AI): the same payee, a total within 15%, submitted in the
     * last 120 days, still alive (waiting, with the Supervisor or approved).
     */
    public function similar(Voucher $voucher): array
    {
        if (! $voucher->payee_name || bccomp((string) $voucher->amount, '0', 2) <= 0) {
            return [];
        }
        $low = bcmul((string) $voucher->amount, '0.85', 2);
        $high = bcmul((string) $voucher->amount, '1.15', 2);

        return Voucher::query()->where('company_id', $this->company->id)->whereKeyNot($voucher->id)
            ->whereIn('status', [S::Pending->value, S::UnderReview->value, S::Approved->value])
            ->where(fn ($w) => $voucher->payee_id
                ? $w->where('payee_id', $voucher->payee_id)->orWhereRaw('LOWER(payee_name) = ?', [mb_strtolower($voucher->payee_name)])
                : $w->whereRaw('LOWER(payee_name) = ?', [mb_strtolower($voucher->payee_name)]))
            ->whereBetween('amount', [$low, $high])
            ->where('submitted_at', '>=', now()->subDays(120))
            ->orderByRaw('ABS(amount - ?)', [(string) $voucher->amount])->limit(3)
            ->get(['id', 'voucher_number', 'status', 'amount', 'reference_number', 'description', 'purpose', 'submitted_at', 'approved_at'])
            ->map(fn (Voucher $v) => [
                'id' => $v->id,
                'voucher_number' => $v->voucher_number,
                'status' => $v->status,
                'amount' => (string) $v->amount,
                'reference_number' => $v->reference_number,
                'summary' => mb_strimwidth((string) ($v->description ?: $v->purpose), 0, 90, '…') ?: null,
                'submitted_at' => $v->submitted_at?->toIso8601String(),
                'approved_at' => $v->approved_at?->toIso8601String(),
            ])->all();
    }

    /**
     * The department's budget for THIS month (budget_allocations), read-only (user decision 2026-11-26):
     * used now and after this voucher. Approving doesn't deduct yet; that comes with the Budgets screens.
     */
    public function budget(Voucher $voucher): ?array
    {
        if (! $voucher->department_id) {
            return null;
        }
        $year = FiscalYear::current($this->company); // budgets are yearly (2026-11-27)
        $row = DB::table('budget_allocations')->where('company_id', $this->company->id)->where('department_id', $voucher->department_id)
            ->where('fiscal_year', $year)->first();
        if (! $row || bccomp((string) $row->total_budget, '0', 2) <= 0) {
            return null;
        }
        $after = bcadd((string) $row->used_amount, (string) $voucher->amount, 2);
        $pct = fn (string $used) => (float) bcdiv(bcmul($used, '100', 4), (string) $row->total_budget, 1);

        return [
            'period' => FiscalYear::label($this->company, $year),
            'department_id' => $voucher->department_id,
            'total' => (string) $row->total_budget,
            'used' => (string) $row->used_amount,
            'used_pct' => $pct((string) $row->used_amount),
            'after_pct' => $pct($after),
            'alert_pct' => (float) $row->alert_threshold_pct,
            'remaining_after' => bcsub((string) $row->total_budget, $after, 2),
        ];
    }
}
