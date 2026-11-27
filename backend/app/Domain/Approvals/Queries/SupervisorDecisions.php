<?php

namespace App\Domain\Approvals\Queries;

use App\Models\Company;
use App\Models\User;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Decision history (Framer K_vQYIg74, 2026-11-27): every Level 2 decision THIS Supervisor made in this company, for one
 * calendar month (or every month), newest first. Filters: action (approved | returned | rejected), search (voucher
 * number or payee). Stats for the month: counts per decision, average decision time (Level 1 approval → your decision)
 * against the month before, and flags overridden (approved while flagged by the automatic check) + how many have remarks.
 */
class SupervisorDecisions
{
    public const ACTIONS = ['approved', 'returned', 'rejected'];

    public function __construct(private User $supervisor, private Company $company) {}

    /** "2026-11" → [start, end) ; null = every month. */
    public static function range(?string $month): ?array
    {
        if (! $month) {
            return null;
        }
        $start = Carbon::createFromFormat('!Y-m', $month);

        return [$start, $start->copy()->addMonth()];
    }

    private function base(?string $month): Builder
    {
        return DB::table('voucher_approvals as a')
            ->join('vouchers as v', 'v.id', '=', 'a.voucher_id')
            ->where('a.approver_id', $this->supervisor->id)->where('a.step', 2)->where('v.company_id', $this->company->id)
            ->whereIn('a.action', self::ACTIONS)
            ->when(self::range($month), fn ($q, $r) => $q->where('a.created_at', '>=', $r[0])->where('a.created_at', '<', $r[1]));
    }

    private function searched(?string $month, ?string $search): Builder
    {
        return $this->base($month)->when($search, function ($q, $search) {
            $like = '%'.addcslashes($search, '\\%_').'%';
            $q->where(fn ($w) => $w->where('v.voucher_number', 'like', $like)->orWhere('v.payee_name', 'like', $like));
        });
    }

    public function query(?string $month, ?string $action, ?string $search): Builder
    {
        return $this->searched($month, $search)
            ->leftJoin('departments as d', 'd.id', '=', 'v.department_id')
            ->leftJoin('users as c', 'c.id', '=', 'v.created_by')
            ->when($action, fn ($q) => $q->where('a.action', $action))
            ->orderByDesc('a.created_at')->orderByDesc('a.id')
            ->select([
                'a.id', 'a.action', 'a.remarks', 'a.needs_changes', 'a.reason', 'a.created_at', 'a.step',
                'v.id as voucher_id', 'v.voucher_number', 'v.payee_name', 'v.amount', 'v.status', 'v.ai_anomaly_flag',
                'd.name as department_name', 'c.first_name as clerk_first', 'c.last_name as clerk_last',
            ]);
    }

    /** Tab numbers: the month + search apply, the action tab doesn't. */
    public function counts(?string $month, ?string $search): array
    {
        $n = $this->searched($month, $search)->groupBy('a.action')->selectRaw('a.action, COUNT(*) as n')->pluck('n', 'action');

        return [
            'all' => (int) $n->sum(),
            'approved' => (int) ($n['approved'] ?? 0),
            'returned' => (int) ($n['returned'] ?? 0),
            'rejected' => (int) ($n['rejected'] ?? 0),
        ];
    }

    /** The 3 cards for a month (null month = every month: no comparison). */
    public function stats(?string $month): array
    {
        $hours = $this->averageHours($month);
        $previous = $month ? $this->averageHours(Carbon::createFromFormat('!Y-m', $month)->subMonth()->format('Y-m')) : null;
        $overridden = $this->base($month)->where('a.action', 'approved')->where('v.ai_anomaly_flag', true);

        return [
            'counts' => $this->counts($month, null),
            'average_hours' => $hours,
            'previous_average_hours' => $previous,
            'previous_month' => $month ? Carbon::createFromFormat('!Y-m', $month)->subMonth()->format('F') : null,
            'overridden' => (clone $overridden)->count(),
            'overridden_with_remarks' => (clone $overridden)->whereNotNull('a.remarks')->where('a.remarks', '<>', '')->count(),
        ];
    }

    /** Hours from the voucher's latest Level 1 approval (before the decision) to your decision, averaged; null if none. */
    public function averageHours(?string $month): ?float
    {
        $seconds = $this->base($month)->selectRaw(
            "AVG(TIMESTAMPDIFF(SECOND, (SELECT MAX(l1.created_at) FROM voucher_approvals l1 WHERE l1.voucher_id = a.voucher_id
                AND l1.step = 1 AND l1.action = 'approved' AND l1.created_at <= a.created_at), a.created_at)) as s"
        )->value('s');

        return $seconds === null ? null : round((float) $seconds / 3600, 1);
    }

    /** Months that have at least one of your decisions, newest first, always including this month ("2026-11"). */
    public function months(): array
    {
        $months = $this->base(null)->selectRaw("DISTINCT DATE_FORMAT(a.created_at, '%Y-%m') as m")->orderByDesc('m')->pluck('m')->all();
        $now = Carbon::now()->format('Y-m');

        return array_values(array_unique(array_merge([$now], $months)));
    }
}
