<?php

namespace App\Domain\Approvals\Queries;

use App\Domain\Approvals\Support\ApprovalRoute;
use App\Domain\Budgets\Support\FiscalYear;
use App\Domain\Vouchers\VoucherStatus as S;
use App\Models\BudgetAllocation;
use App\Models\Company;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * The Accounting Officer's dashboard (Framer tfDekIe0N, the officer's landing page since 2026-11-27).
 * Real numbers only, for the company in X-Company-ID:
 *   queue        waiting for Level 1: count, total, older than 24 h, near the SLA, flagged
 *   mine         YOUR Level 1 decisions this month: approved (count + total), returned
 *   review_time  YOUR average time from submission to decision this month vs last month (hours);
 *                "submission" = the latest voucher_submitted audit row before the decision, so a
 *                resubmitted voucher counts from its resubmission
 *   top          the first 4 of the queue: flagged first, then oldest
 *   budgets      this fiscal year's department budgets (budget_allocations, yearly), most used first
 *   spend        approved spending in the company this month vs the same days last month
 */
class OfficerDashboardSummary
{
    public function __construct(private User $officer, private Company $company, private ApprovalRoute $route) {}

    public function queue(): array
    {
        $base = fn () => DB::table('vouchers')->where('company_id', $this->company->id)->where('status', S::Pending->value);

        return [
            'total' => $base()->count(),
            'total_amount' => number_format((float) $base()->sum('amount'), 2, '.', ''), // "0.00", like every other amount
            'older_than_24h' => $base()->where('submitted_at', '<=', now()->subDay())->count(),
            'near_sla' => $base()->where('submitted_at', '<=', $this->route->nearSlaSince())->count(),
            'flagged' => $base()->where('ai_anomaly_flag', true)->whereNull('ai_review_finding')->count(),
            'sla_hours' => $this->route->slaHours(),
        ];
    }

    public function mine(): array
    {
        $rows = $this->decisions(Carbon::now()->startOfMonth(), Carbon::now())
            ->selectRaw('a.action, COUNT(*) as n, COALESCE(SUM(v.amount), 0) as total')->groupBy('a.action')->get()->keyBy('action');

        return [
            'month' => Carbon::now()->format('F'),
            'approved' => (int) ($rows['approved']->n ?? 0),
            'approved_amount' => (string) ($rows['approved']->total ?? '0.00'),
            'returned' => (int) ($rows['returned']->n ?? 0),
            'rejected' => (int) ($rows['rejected']->n ?? 0),
        ];
    }

    public function reviewTime(): array
    {
        $now = $this->averageHours(Carbon::now()->startOfMonth(), Carbon::now());
        $before = $this->averageHours(Carbon::now()->subMonthNoOverflow()->startOfMonth(), Carbon::now()->startOfMonth());

        return [
            'avg_hours' => $now,
            'previous_avg_hours' => $before,
            'previous_month' => Carbon::now()->subMonthNoOverflow()->format('F'),
            'change_pct' => ($now !== null && $before) ? (int) round(($now - $before) / $before * 100) : null,
        ];
    }

    /** The queue's first rows for the dashboard: flagged ones on top, then oldest submission first. */
    public function top(int $limit = 4)
    {
        return (new ReviewQueue($this->officer, $this->company, $this->route))->list([])
            ->reorder()->orderByRaw('(vouchers.ai_anomaly_flag = 1 AND vouchers.ai_review_finding IS NULL) DESC')
            ->orderBy('vouchers.submitted_at')->orderBy('vouchers.id')->limit($limit)->get();
    }

    /** This fiscal year's department budgets, most used first (yearly since 2026-11-27). */
    public function budgets(): array
    {
        $year = FiscalYear::current($this->company);

        return [
            'label' => FiscalYear::label($this->company, $year),
            'elapsed_pct' => FiscalYear::elapsedPct($this->company, $year),
            'rows' => DB::table('budget_allocations as b')->join('departments as d', 'd.id', '=', 'b.department_id')
                ->where('b.company_id', $this->company->id)->where('b.fiscal_year', $year)->where('b.total_budget', '>', 0)
                ->get(['d.id', 'd.name', 'b.total_budget', 'b.used_amount', 'b.alert_threshold_pct'])
                ->map(fn ($b) => [
                    'department_id' => $b->id,
                    'department' => $b->name,
                    'total' => (string) $b->total_budget,
                    'used' => (string) $b->used_amount,
                    'used_pct' => BudgetAllocation::pct((string) $b->used_amount, (string) $b->total_budget),
                    'alert_pct' => (float) $b->alert_threshold_pct,
                ])
                ->sortByDesc('used_pct')->values()->all(),
        ];
    }

    public function spend(): array
    {
        $now = Carbon::now();
        $start = $now->copy()->startOfMonth();
        $prevStart = $start->copy()->subMonthNoOverflow();
        $prevSameDay = $prevStart->copy()->addSeconds($start->diffInSeconds($now)); // the same point in last month

        $sum = fn ($from, $to) => (string) DB::table('vouchers')->where('company_id', $this->company->id)->where('status', S::Approved->value)
            ->whereBetween('approved_at', [$from, $to])->sum('amount');
        $current = $sum($start, $now);
        $before = $sum($prevStart, $prevSameDay);

        return [
            'month' => $now->format('F Y'),
            'approved_amount' => $current,
            'previous_same_period' => $before,
            'previous_month' => $prevStart->format('F'),
            'change_pct' => bccomp($before, '0', 2) > 0 ? (int) round(((float) $current - (float) $before) / (float) $before * 100) : null,
        ];
    }

    private function decisions(Carbon $from, Carbon $to)
    {
        return DB::table('voucher_approvals as a')->join('vouchers as v', 'v.id', '=', 'a.voucher_id')
            ->where('a.approver_id', $this->officer->id)->where('a.step', 1)->where('v.company_id', $this->company->id)
            ->whereBetween('a.created_at', [$from, $to]);
    }

    private function averageHours(Carbon $from, Carbon $to): ?float
    {
        $minutes = $this->decisions($from, $to)
            ->selectRaw("AVG(TIMESTAMPDIFF(MINUTE, (SELECT MAX(l.created_at) FROM audit_logs l WHERE l.table_name = 'vouchers'
                AND l.record_id = a.voucher_id AND l.action = 'voucher_submitted' AND l.created_at <= a.created_at), a.created_at)) as m")
            ->value('m');

        return $minutes === null ? null : round((float) $minutes / 60, 1);
    }
}
