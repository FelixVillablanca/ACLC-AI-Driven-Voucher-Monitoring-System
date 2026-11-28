<?php

namespace App\Domain\Budgets\Queries;

use App\Domain\Audit\AuditCatalog;
use App\Domain\Budgets\Support\FiscalYear;
use App\Domain\Platform\SystemSettings;
use App\Domain\Vouchers\VoucherStatus as S;
use App\Models\BudgetAllocation;
use App\Models\BudgetChangeRequest;
use App\Models\Company;
use App\Models\Department;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * What the Accounting Officer's Budgets pages show (2026-11-27), for the company in X-Company-ID. Real data only:
 *   overview($year)              Framer AwnFnuBYJ: 4 cards + one row per department (with or without a budget)
 *   department($id, $year)       Framer kpJmhDxKE: the numbers, usage bar, monthly spend, by category,
 *                                a pending sign-off request and the change history
 *   alertCount()                 the sidebar's "N alert(s)": this fiscal year's budgets at or over their alert %
 * "Pending" = vouchers still in review (pending + under_review): not spent yet, but on their way.
 * "Unbudgeted" (2026-11-28) = approved spending in that fiscal year that no budget covers: departments with no budget
 *   for the year, and vouchers with no department. It isn't lost: a budget allocated later starts with it (usedFor).
 */
class BudgetBoard
{
    private const IN_REVIEW = [S::Pending->value, S::UnderReview->value];

    public function __construct(private Company $company, private User $viewer) {}

    /** @return list<int> fiscal years to pick from: those with budgets, this one and the next, newest first */
    public function years(): array
    {
        $current = FiscalYear::current($this->company);
        $years = BudgetAllocation::query()->where('company_id', $this->company->id)->distinct()->pluck('fiscal_year')->map(fn ($y) => (int) $y)->all();

        return collect([...$years, $current, $current + 1])->unique()->sortDesc()->values()->all();
    }

    public function overview(int $year): array
    {
        $budgets = $this->budgets($year)->keyBy('department_id');
        $requests = $this->pendingRequests($budgets->pluck('id')->all());

        $rows = Department::query()->where('company_id', $this->company->id)
            ->where(fn ($q) => $q->where('is_active', true)->orWhereIn('id', $budgets->keys()))
            ->orderBy('name')->get(['id', 'name', 'code', 'is_active'])
            ->map(fn (Department $d) => [
                'department' => ['id' => $d->id, 'name' => $d->name, 'code' => $d->code, 'is_active' => (bool) $d->is_active],
                'budget' => ($b = $budgets->get($d->id)) ? $this->budgetData($b, $requests->get($b->id)) : null,
            ])
            ->sortBy(fn ($r) => $r['budget'] ? -$r['budget']['used_pct'] : PHP_INT_MAX)->values();

        $total = (string) $budgets->reduce(fn ($c, $b) => bcadd($c, (string) $b->total_budget, 2), '0.00');
        $used = (string) $budgets->reduce(fn ($c, $b) => bcadd($c, (string) $b->used_amount, 2), '0.00');
        $over = $rows->filter(fn ($r) => $r['budget'] && $r['budget']['over_alert'])->values();

        return [
            'company' => $this->company->name,
            'fiscal_year' => $year,
            'current_year' => FiscalYear::current($this->company),
            'label' => FiscalYear::label($this->company, $year),
            'years' => array_map(fn ($y) => ['year' => $y, 'label' => FiscalYear::label($this->company, $y)], $this->years()),
            'period' => $this->period($year),
            'summary' => [
                'total_allocated' => $total,
                'departments' => $budgets->count(),
                'used' => $used,
                'used_pct' => BudgetAllocation::pct($used, $total),
                'remaining' => bcsub($total, $used, 2),
                'pending_amount' => $this->isCurrent($year) ? (string) $this->inReview()->selectRaw('COALESCE(SUM(amount), 0) as t')->value('t') : null,
                'pending_count' => $this->isCurrent($year) ? $this->inReview()->count() : null,
                'over_alert' => $over->count(),
                'over_alert_first' => $over->first() ? ['name' => $over->first()['department']['name'], 'used_pct' => $over->first()['budget']['used_pct']] : null,
            ],
            'rows' => $rows->all(),
            'unbudgeted' => $this->unbudgeted($year, $budgets->keys()->all()),
            'can_allocate' => $rows->contains(fn ($r) => ! $r['budget'] && $r['department']['is_active']),
            'signoff_above' => $this->signoffAbove(),
        ];
    }

    public function department(int $departmentId, int $year): array
    {
        $department = Department::query()->where('company_id', $this->company->id)->with('head:id,first_name,last_name')->findOrFail($departmentId);
        $budget = $this->budgets($year)->firstWhere('department_id', $department->id);
        $request = $budget ? $this->pendingRequests([$budget->id])->get($budget->id) : null;
        [$from, $to] = FiscalYear::range($this->company, $year);

        $current = $this->isCurrent($year);
        $pending = $current ? $this->inReview()->where('department_id', $department->id) : null;
        $pendingAmount = $pending ? (string) (clone $pending)->selectRaw('COALESCE(SUM(amount), 0) as t')->value('t') : '0.00';
        $data = $budget ? $this->budgetData($budget, $request) : null;
        if ($data) {
            $data['remaining'] = bcsub((string) $budget->total_budget, (string) $budget->used_amount, 2);
            $data['after_pending_pct'] = BudgetAllocation::pct(bcadd((string) $budget->used_amount, $pendingAmount, 2), (string) $budget->total_budget);
        }

        return [
            'company' => $this->company->name,
            'fiscal_year' => $year,
            'current_year' => FiscalYear::current($this->company),
            'label' => FiscalYear::label($this->company, $year),
            'years' => array_map(fn ($y) => ['year' => $y, 'label' => FiscalYear::label($this->company, $y)], $this->years()),
            'period' => $this->period($year),
            'department' => [
                'id' => $department->id, 'name' => $department->name, 'code' => $department->code, 'is_active' => (bool) $department->is_active,
                'head' => $department->head ? trim($department->head->first_name.' '.$department->head->last_name) : null,
                'vouchers_this_month' => DB::table('vouchers')->where('company_id', $this->company->id)->where('department_id', $department->id)
                    ->whereNotIn('status', [S::Draft->value, S::Cancelled->value])
                    ->whereBetween('submitted_at', [Carbon::now()->startOfMonth(), Carbon::now()])->count(),
            ],
            'budget' => $data,
            'pending' => $current ? [
                'amount' => $pendingAmount,
                'count' => (clone $pending)->count(),
                'top' => (clone $pending)->orderByDesc('amount')->limit(3)->get(['id', 'voucher_number', 'payee_name', 'amount', 'status'])
                    ->map(fn ($v) => ['id' => $v->id, 'voucher_number' => $v->voucher_number, 'payee_name' => $v->payee_name, 'amount' => (string) $v->amount, 'status' => $v->status])->all(),
            ] : null,
            'monthly' => $this->monthly($department->id, $from, $year),
            'categories' => $this->categories($department->id, $from, $to),
            'request' => $request ? $this->requestData($request) : null,
            'history' => $budget ? $this->history($budget->id) : [],
            'signoff_above' => $this->signoffAbove(),
        ];
    }

    public function alertCount(): int
    {
        return BudgetAllocation::query()->where('company_id', $this->company->id)->where('fiscal_year', FiscalYear::current($this->company))
            ->where('total_budget', '>', 0)->whereRaw('used_amount * 100 >= total_budget * alert_threshold_pct')->count();
    }

    /**
     * Approved spending of the fiscal year that no budget covers.
     *
     * @param  list<int>  $budgetedDepartments
     * @return array{amount: string, count: int, departments: list<array{id: int, name: string, amount: string, count: int}>, no_department: array{amount: string, count: int}}
     */
    private function unbudgeted(int $year, array $budgetedDepartments): array
    {
        [$from, $to] = FiscalYear::range($this->company, $year);
        $rows = DB::table('vouchers as v')
            ->leftJoin('departments as d', 'd.id', '=', 'v.department_id')
            ->where('v.company_id', $this->company->id)->where('v.status', S::Approved->value)
            ->whereBetween('v.approved_at', [$from, $to])
            ->where(fn ($q) => $q->whereNull('v.department_id')
                ->when($budgetedDepartments !== [], fn ($q) => $q->orWhereNotIn('v.department_id', $budgetedDepartments),
                    fn ($q) => $q->orWhereNotNull('v.department_id')))
            ->groupBy('v.department_id', 'd.name')
            ->selectRaw('v.department_id, d.name, COALESCE(SUM(v.amount), 0) as amount, COUNT(*) as n')
            ->get();

        $none = $rows->firstWhere('department_id', null);
        $departments = $rows->whereNotNull('department_id')
            ->map(fn ($r) => ['id' => (int) $r->department_id, 'name' => (string) $r->name, 'amount' => number_format((float) $r->amount, 2, '.', ''), 'count' => (int) $r->n])
            ->sortByDesc(fn ($r) => (float) $r['amount'])->values()->all();
        $total = $rows->reduce(fn ($c, $r) => bcadd($c, (string) $r->amount, 2), '0.00');

        return [
            'amount' => $total,
            'count' => (int) $rows->sum('n'),
            'departments' => $departments,
            'no_department' => ['amount' => $none ? number_format((float) $none->amount, 2, '.', '') : '0.00', 'count' => $none ? (int) $none->n : 0],
        ];
    }

    private function budgets(int $year)
    {
        return BudgetAllocation::query()->where('company_id', $this->company->id)->where('fiscal_year', $year)->get();
    }

    private function pendingRequests(array $budgetIds)
    {
        return BudgetChangeRequest::query()->whereIn('budget_allocation_id', $budgetIds)->where('status', 'pending')
            ->with('requester:id,first_name,last_name')->get()->keyBy('budget_allocation_id');
    }

    private function budgetData(BudgetAllocation $b, ?BudgetChangeRequest $request): array
    {
        $pct = BudgetAllocation::pct((string) $b->used_amount, (string) $b->total_budget, 1);

        return [
            'id' => $b->id,
            'total' => (string) $b->total_budget,
            'used' => (string) $b->used_amount,
            'used_pct' => $pct,
            'alert_pct' => (float) $b->alert_threshold_pct,
            'over_alert' => bccomp((string) $b->total_budget, '0', 2) > 0 && $pct >= (float) $b->alert_threshold_pct,
            'alert_since' => $b->alert_sent_at?->toIso8601String(),
            'updated_at' => $b->updated_at?->toIso8601String(),
            'pending_request' => $request ? ['id' => $request->id, 'requested_budget' => (string) $request->requested_budget] : null,
        ];
    }

    private function requestData(BudgetChangeRequest $r): array
    {
        return [
            'id' => $r->id,
            'current_budget' => (string) $r->current_budget,
            'requested_budget' => (string) $r->requested_budget,
            'current_alert_pct' => (float) $r->current_alert_pct,
            'requested_alert_pct' => (float) $r->requested_alert_pct,
            'reason' => $r->reason,
            'requested_by' => $r->requester ? trim($r->requester->first_name.' '.$r->requester->last_name) : null,
            'mine' => (int) $r->requested_by === (int) $this->viewer->id,
            'created_at' => $r->created_at?->toIso8601String(),
        ];
    }

    /** Approved spending per month of the fiscal year (12 entries; future months are marked). */
    private function monthly(int $departmentId, Carbon $from, int $year): array
    {
        $to = $from->copy()->addMonthsNoOverflow(12)->subSecond();
        $sums = DB::table('vouchers')->where('company_id', $this->company->id)->where('department_id', $departmentId)
            ->where('status', S::Approved->value)->whereBetween('approved_at', [$from, $to])
            ->selectRaw("DATE_FORMAT(approved_at, '%Y-%m') as ym, SUM(amount) as total")->groupBy('ym')->pluck('total', 'ym');
        $now = Carbon::now();

        return collect(range(0, 11))->map(function ($i) use ($from, $sums, $now) {
            $m = $from->copy()->addMonthsNoOverflow($i);

            return [
                'month' => $m->format('Y-m'),
                'label' => $m->format('M'),
                'approved' => (string) ($sums[$m->format('Y-m')] ?? '0.00'),
                'is_current' => $m->isSameMonth($now),
                'is_future' => $m->copy()->startOfMonth()->gt($now),
            ];
        })->all();
    }

    /** Approved spending of the fiscal year by category, biggest first (top 5 + "Other"). */
    private function categories(int $departmentId, Carbon $from, Carbon $to): array
    {
        $rows = DB::table('vouchers as v')->leftJoin('voucher_categories as c', 'c.id', '=', 'v.category_id')
            ->where('v.company_id', $this->company->id)->where('v.department_id', $departmentId)
            ->where('v.status', S::Approved->value)->whereBetween('v.approved_at', [$from, $to])
            ->groupBy('c.name')->selectRaw('COALESCE(c.name, ?) as name, SUM(v.amount) as total', ['No category'])
            ->orderByDesc('total')->get();
        $sum = (string) $rows->reduce(fn ($c, $r) => bcadd($c, (string) $r->total, 2), '0.00');
        $top = $rows->take(5)->map(fn ($r) => ['name' => $r->name, 'amount' => (string) $r->total]);
        if ($rows->count() > 5) {
            $rest = (string) $rows->slice(5)->reduce(fn ($c, $r) => bcadd($c, (string) $r->total, 2), '0.00');
            $top->push(['name' => 'Other', 'amount' => $rest]);
        }

        return $top->map(fn ($r) => $r + ['pct' => BudgetAllocation::pct($r['amount'], $sum)])->values()->all();
    }

    /** The budget's audit rows, newest first (who, what, old → new, reason). */
    private function history(int $budgetId): array
    {
        return DB::table('audit_logs as l')->leftJoin('users as u', 'u.id', '=', 'l.user_id')
            ->where('l.table_name', 'budget_allocations')->where('l.record_id', $budgetId)
            ->orderByDesc('l.id')->limit(10)
            ->get(['l.id', 'l.action', 'l.old_values', 'l.new_values', 'l.created_at', 'u.first_name', 'u.last_name'])
            ->map(function ($r) {
                $old = json_decode((string) $r->old_values, true) ?: [];
                $new = json_decode((string) $r->new_values, true) ?: [];

                return [
                    'id' => $r->id,
                    'action' => $r->action,
                    'label' => AuditCatalog::describe($r->action)['label'],
                    'by' => $r->first_name ? trim($r->first_name.' '.$r->last_name) : 'System',
                    'at' => Carbon::parse($r->created_at)->toIso8601String(),
                    'from' => isset($old['total_budget']) ? ['total' => $old['total_budget'], 'alert_pct' => (float) ($old['alert_threshold_pct'] ?? 0)] : null,
                    'to' => isset($new['total_budget']) ? ['total' => $new['total_budget'], 'alert_pct' => (float) ($new['alert_threshold_pct'] ?? 0)] : null,
                    'reason' => $new['reason'] ?? null,
                ];
            })->all();
    }

    private function inReview()
    {
        return DB::table('vouchers')->where('company_id', $this->company->id)->whereIn('status', self::IN_REVIEW);
    }

    private function isCurrent(int $year): bool
    {
        return $year === FiscalYear::current($this->company);
    }

    /** @return array{state: string, elapsed_pct: int, starts: string, ends: string} state = current | past | future */
    private function period(int $year): array
    {
        [$from, $to] = FiscalYear::range($this->company, $year);
        $current = FiscalYear::current($this->company);

        return [
            'state' => $year === $current ? 'current' : ($year < $current ? 'past' : 'future'),
            'elapsed_pct' => FiscalYear::elapsedPct($this->company, $year),
            'starts' => $from->toDateString(),
            'ends' => $to->toDateString(),
        ];
    }

    private function signoffAbove(): string
    {
        return (string) app(SystemSettings::class)->value(SystemSettings::BUDGET_CHANGE_SIGNOFF_ABOVE);
    }
}
