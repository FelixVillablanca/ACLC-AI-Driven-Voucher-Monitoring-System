<?php

namespace App\Domain\Approvals\Queries;

use App\Domain\Approvals\Support\ApprovalRoute;
use App\Domain\Budgets\Support\FiscalYear;
use App\Domain\Vouchers\VoucherStatus as S;
use App\Models\BudgetAllocation;
use App\Models\BudgetChangeRequest;
use App\Models\Company;
use App\Models\FinancialReport;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * The Supervisor / Manager's dashboard (Framer YKfX_oJ3a, the landing page since 2026-11-27). Real numbers only,
 * for the company in X-Company-ID:
 *   queue      waiting for Level 2 (`under_review`): count, total, oldest wait (days since Level 1 approved it), flagged
 *   released   vouchers that got their FINAL approval this month in the company (count + total)
 *   budget     this fiscal year's budgets added up: used of total (null when no budget is set)
 *   top        the first 4 of the Level 2 queue (flagged first, then oldest)
 *   pipeline   drafts (clerks) → Level 1 (pending) → Level 2 (under_review) → approved this month
 *   signoffs   budget changes (+ ₱ in top-ups) and financial reports waiting for a Supervisor's sign-off
 *   alert      the department whose budget would go highest if everything waiting at Level 2 for it were approved,
 *              when that passes its alert % (null otherwise)
 */
class SupervisorDashboardSummary
{
    public function __construct(private User $supervisor, private Company $company, private ApprovalRoute $route) {}

    private function vouchers()
    {
        return DB::table('vouchers')->where('company_id', $this->company->id);
    }

    public function queue(): array
    {
        $base = fn () => $this->vouchers()->where('status', S::UnderReview->value);
        $oldest = DB::table('voucher_approvals as a')->join('vouchers as v', 'v.id', '=', 'a.voucher_id')
            ->where('v.company_id', $this->company->id)->where('v.status', S::UnderReview->value)
            ->where('a.step', 1)->where('a.action', 'approved')->min('a.created_at');

        return [
            'total' => $base()->count(),
            'total_amount' => number_format((float) $base()->sum('amount'), 2, '.', ''),
            'oldest_days' => $oldest ? (int) Carbon::parse($oldest)->startOfDay()->diffInDays(Carbon::today()) : null,
            'flagged' => $base()->where('ai_anomaly_flag', true)->count(),
        ];
    }

    public function released(): array
    {
        $q = fn () => $this->vouchers()->where('status', S::Approved->value)->where('approved_at', '>=', Carbon::now()->startOfMonth());

        return [
            'month' => Carbon::now()->format('F'),
            'count' => $q()->count(),
            'amount' => number_format((float) $q()->sum('amount'), 2, '.', ''),
        ];
    }

    public function budget(): ?array
    {
        $year = FiscalYear::current($this->company);
        $rows = BudgetAllocation::query()->where('company_id', $this->company->id)->where('fiscal_year', $year)->get();
        if ($rows->isEmpty()) {
            return null;
        }
        $total = (string) $rows->reduce(fn ($c, $b) => bcadd($c, (string) $b->total_budget, 2), '0.00');
        $used = (string) $rows->reduce(fn ($c, $b) => bcadd($c, (string) $b->used_amount, 2), '0.00');

        return ['label' => FiscalYear::label($this->company, $year), 'total' => $total, 'used' => $used, 'used_pct' => (int) BudgetAllocation::pct($used, $total)];
    }

    public function top(int $limit = 4)
    {
        return (new ReviewQueue($this->supervisor, $this->company, $this->route, step: 2))->list([])
            ->reorder()->orderByRaw('(vouchers.ai_anomaly_flag = 1) DESC')
            ->orderBy('vouchers.submitted_at')->orderBy('vouchers.id')->limit($limit)->get();
    }

    public function pipeline(): array
    {
        $count = fn (string $status) => $this->vouchers()->where('status', $status)->count();

        return [
            'drafts' => $count(S::Draft->value),
            'level1' => $count(S::Pending->value),
            'level2' => $count(S::UnderReview->value),
            'approved_this_month' => $this->released()['count'],
        ];
    }

    /** What waits for a Supervisor's sign-off besides vouchers (polish 2026-11-27): budget changes + financial reports. */
    public function signoffs(): array
    {
        $changes = BudgetChangeRequest::query()->where('company_id', $this->company->id)->where('status', 'pending');
        $up = (string) (clone $changes)->get(['current_budget', 'requested_budget'])
            ->reduce(fn ($c, $r) => bccomp((string) $r->requested_budget, (string) $r->current_budget, 2) > 0
                ? bcadd($c, bcsub((string) $r->requested_budget, (string) $r->current_budget, 2), 2) : $c, '0.00');

        return [
            'budget_changes' => (clone $changes)->count(),
            'budget_top_ups' => $up,
            'reports' => FinancialReport::query()->where('company_id', $this->company->id)->where('signoff_status', 'pending')->count(),
        ];
    }

    public function alert(): ?array
    {
        $year = FiscalYear::current($this->company);
        $waiting = $this->vouchers()->where('status', S::UnderReview->value)->whereNotNull('department_id')
            ->groupBy('department_id')->selectRaw('department_id, COUNT(*) as n, SUM(amount) as total, SUM(ai_anomaly_flag = 1) as flagged')
            ->get()->keyBy('department_id');
        if ($waiting->isEmpty()) {
            return null;
        }
        $best = null;
        $budgets = BudgetAllocation::query()->where('company_id', $this->company->id)->where('fiscal_year', $year)
            ->whereIn('department_id', $waiting->keys())->with('department:id,name')->get();
        foreach ($budgets as $b) {
            if (bccomp((string) $b->total_budget, '0', 2) <= 0) {
                continue;
            }
            $w = $waiting[$b->department_id];
            $after = BudgetAllocation::pct(bcadd((string) $b->used_amount, (string) $w->total, 2), (string) $b->total_budget);
            if ($after >= (float) $b->alert_threshold_pct && (! $best || $after > $best['after_pct'])) {
                $best = [
                    'department' => $b->department?->name,
                    'department_id' => $b->department_id,
                    'used_pct' => (int) $b->usedPct(),
                    'after_pct' => (int) $after,
                    'alert_pct' => (float) $b->alert_threshold_pct,
                    'waiting' => (int) $w->n,
                    'waiting_flagged' => (int) $w->flagged,
                    'waiting_amount' => number_format((float) $w->total, 2, '.', ''),
                ];
            }
        }

        return $best;
    }
}
