<?php

namespace App\Domain\Reporting\Support;

use App\Domain\Budgets\Support\FiscalYear;
use App\Domain\Vouchers\VoucherStatus as S;
use App\Models\BudgetAllocation;
use App\Models\Company;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * THE NUMBERS of a financial report (2026-11-27), worked out once and frozen in financial_reports.figures.
 * "Spend" = vouchers whose FINAL approval (approved_at) falls in the period. Rejected / returned = decisions
 * made in the period (voucher_approvals). Flagged = vouchers submitted in the period that the automatic check
 * flagged (still flagged = not reviewed yet and still in review). Budget = the fiscal year of the period's end.
 * Money is DECIMAL strings; percentages are whole numbers.
 *
 * @phpstan-type Includes array{summary: bool, breakdown: bool, flagged: bool, forecast: bool}
 */
class ReportFigures
{
    private const IN_REVIEW = [S::Pending->value, S::UnderReview->value];

    /** @param Includes $includes */
    public function build(Company $company, ?int $departmentId, ReportPeriod $p, array $includes): array
    {
        $approved = fn (Carbon $from, Carbon $to) => DB::table('vouchers as v')->where('v.company_id', $company->id)
            ->when($departmentId, fn ($q) => $q->where('v.department_id', $departmentId))
            ->where('v.status', S::Approved->value)->whereBetween('v.approved_at', [$from, $to]);

        $total = $this->sum($approved($p->start, $p->end));
        $previous = $this->sum($approved($p->previousStart, $p->previousEnd));
        $decisions = DB::table('voucher_approvals as a')->join('vouchers as v', 'v.id', '=', 'a.voucher_id')
            ->where('v.company_id', $company->id)->when($departmentId, fn ($q) => $q->where('v.department_id', $departmentId))
            ->whereBetween('a.created_at', [$p->start, $p->end])->groupBy('a.action')->selectRaw('a.action, COUNT(DISTINCT a.voucher_id) as n')
            ->pluck('n', 'action');
        $flaggedBase = DB::table('vouchers as v')->where('v.company_id', $company->id)
            ->when($departmentId, fn ($q) => $q->where('v.department_id', $departmentId))
            ->whereBetween('v.submitted_at', [$p->start, $p->end])
            ->where(fn ($q) => $q->where('v.ai_anomaly_flag', true)->orWhereNotNull('v.ai_review_finding'));

        $figures = [
            'period' => ['start' => $p->start->toDateString(), 'end' => $p->end->toDateString(), 'label' => $p->label, 'previous_label' => $p->previousLabel],
            'total_spend' => $total,
            'previous_spend' => $previous,
            'change_pct' => $this->change($total, $previous),
            'approved' => (clone $approved($p->start, $p->end))->count(),
            'rejected' => (int) ($decisions['rejected'] ?? 0),
            'returned' => (int) ($decisions['returned'] ?? 0),
            'flagged' => (clone $flaggedBase)->count(),
            'flagged_open' => (clone $flaggedBase)->where('v.ai_anomaly_flag', true)->whereNull('v.ai_review_finding')->whereIn('v.status', self::IN_REVIEW)->count(),
            'budget' => $this->budget($company, $departmentId, $p),
            'in_review' => [
                'count' => DB::table('vouchers')->where('company_id', $company->id)->when($departmentId, fn ($q) => $q->where('department_id', $departmentId))
                    ->whereIn('status', self::IN_REVIEW)->count(),
            ],
        ];

        if ($includes['breakdown']) {
            $figures['departments'] = $departmentId ? [] : $this->byDepartment($company, $p);
            $figures['categories'] = $this->byCategory($company, $departmentId, $p);
        }
        if ($includes['flagged']) {
            $figures['flagged_list'] = (clone $flaggedBase)->orderByDesc('v.amount')->limit(20)
                ->get(['v.id', 'v.voucher_number', 'v.amount', 'v.status', 'v.ai_anomaly_score', 'v.ai_anomaly_flag', 'v.ai_review_finding'])
                ->map(fn ($v) => [
                    'id' => $v->id, 'voucher_number' => $v->voucher_number, 'amount' => (string) $v->amount, 'status' => $v->status,
                    'score' => $v->ai_anomaly_score !== null ? (float) $v->ai_anomaly_score : null,
                    'finding' => $v->ai_review_finding ?? ($v->ai_anomaly_flag ? 'open' : null),
                ])->all();
        }
        if ($includes['forecast']) {
            $figures['forecast'] = $this->forecast($company, $departmentId, $p);
        }

        return $figures;
    }

    private function sum($query): string
    {
        return (string) $query->selectRaw('COALESCE(SUM(v.amount), 0) as t')->value('t');
    }

    private function change(string $now, string $before): ?int
    {
        return bccomp($before, '0', 2) > 0 ? (int) round(((float) $now - (float) $before) / (float) $before * 100) : null;
    }

    private function budget(Company $company, ?int $departmentId, ReportPeriod $p): ?array
    {
        $year = FiscalYear::of($company, $p->end->copy());
        $rows = BudgetAllocation::query()->where('company_id', $company->id)->where('fiscal_year', $year)
            ->when($departmentId, fn ($q) => $q->where('department_id', $departmentId))->get();
        if ($rows->isEmpty()) {
            return null;
        }
        $total = (string) $rows->reduce(fn ($c, $b) => bcadd($c, (string) $b->total_budget, 2), '0.00');
        $used = (string) $rows->reduce(fn ($c, $b) => bcadd($c, (string) $b->used_amount, 2), '0.00');

        return ['label' => FiscalYear::label($company, $year), 'total' => $total, 'used' => $used, 'used_pct' => (int) BudgetAllocation::pct($used, $total)];
    }

    private function byDepartment(Company $company, ReportPeriod $p): array
    {
        $q = fn (Carbon $from, Carbon $to) => DB::table('vouchers as v')->leftJoin('departments as d', 'd.id', '=', 'v.department_id')
            ->where('v.company_id', $company->id)->where('v.status', S::Approved->value)->whereBetween('v.approved_at', [$from, $to])
            ->groupBy('d.name')->selectRaw('COALESCE(d.name, ?) as name, SUM(v.amount) as total, COUNT(*) as n', ['No department'])->get()->keyBy('name');
        $now = $q($p->start, $p->end);
        $before = $q($p->previousStart, $p->previousEnd);

        return $now->sortByDesc('total')->values()->map(fn ($r) => [
            'name' => $r->name, 'amount' => (string) $r->total, 'vouchers' => (int) $r->n,
            'change_pct' => $this->change((string) $r->total, (string) ($before[$r->name]->total ?? '0')),
        ])->all();
    }

    private function byCategory(Company $company, ?int $departmentId, ReportPeriod $p): array
    {
        $q = fn (Carbon $from, Carbon $to) => DB::table('vouchers as v')->leftJoin('voucher_categories as c', 'c.id', '=', 'v.category_id')
            ->where('v.company_id', $company->id)->when($departmentId, fn ($x) => $x->where('v.department_id', $departmentId))
            ->where('v.status', S::Approved->value)->whereBetween('v.approved_at', [$from, $to])
            ->groupBy('c.name')->selectRaw('COALESCE(c.name, ?) as name, SUM(v.amount) as total, COUNT(*) as n', ['No category'])->get()->keyBy('name');
        $now = $q($p->start, $p->end);
        $before = $q($p->previousStart, $p->previousEnd);

        return $now->sortByDesc('total')->take(8)->values()->map(fn ($r) => [
            'name' => $r->name, 'amount' => (string) $r->total, 'vouchers' => (int) $r->n,
            'change_pct' => $this->change((string) $r->total, (string) ($before[$r->name]->total ?? '0')),
        ])->all();
    }

    private function forecast(Company $company, ?int $departmentId, ReportPeriod $p): ?array
    {
        $month = $p->end->copy()->addDay()->startOfMonth();
        $row = DB::table('ai_forecasts')->where('company_id', $company->id)
            ->when($departmentId, fn ($q) => $q->where('department_id', $departmentId), fn ($q) => $q->whereNull('department_id'))
            ->where('forecast_for_month', $month->toDateString())->first();

        return $row ? [
            'month' => $month->format('F Y'), 'predicted' => (string) $row->predicted_spend,
            'lower' => (string) $row->lower_bound, 'upper' => (string) $row->upper_bound,
        ] : null;
    }
}
