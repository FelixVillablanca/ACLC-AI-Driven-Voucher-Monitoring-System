<?php

namespace App\Domain\Approvals\Queries;

use App\Domain\Approvals\Support\ApprovalRoute;
use App\Domain\Vouchers\VoucherStatus as S;
use App\Models\Company;
use App\Models\User;
use App\Models\Voucher;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * The Supervisor's flagged vouchers (Framer ESBUdF0jl list, lFqUUsfzi investigate; 2026-11-27), company = X-Company-ID.
 *   list()          flagged vouchers waiting for Level 2 (`under_review`), highest score first (or oldest / amount)
 *   stats()         open flags + money on hold; flagged vouchers YOU decided at Level 2 this month; flags of the last
 *                   90 days that reached an end (approved / rejected) and how many of them ended in a rejection
 *   pastPayments()  the payee's other submitted vouchers in this company (newest first)
 * Real data only: "flagged" = `ai_anomaly_flag` from the automatic check (rules until the Phase 5 model).
 */
class Level2Flags
{
    public const SORTS = ['score', 'oldest', 'amount_desc'];

    public function __construct(private User $supervisor, private Company $company, private ApprovalRoute $route) {}

    private function queue(): ReviewQueue
    {
        return new ReviewQueue($this->supervisor, $this->company, $this->route, step: 2);
    }

    public function list(?string $sort = null): Builder
    {
        $q = $this->queue()->list(['view' => 'ai_flagged'])->reorder();

        return match ($sort) {
            'oldest' => $q->orderBy('vouchers.submitted_at')->orderBy('vouchers.id'),
            'amount_desc' => $q->orderByDesc('vouchers.amount')->orderBy('vouchers.id'),
            default => $q->orderByDesc('vouchers.ai_anomaly_score')->orderBy('vouchers.submitted_at')->orderBy('vouchers.id'),
        };
    }

    public function stats(): array
    {
        $open = $this->queue()->base()->where('vouchers.ai_anomaly_flag', true);

        // Flagged vouchers this Supervisor decided at Level 2 this month (latest decision per voucher counts once)
        $decided = DB::table('voucher_approvals as a')->join('vouchers as v', 'v.id', '=', 'a.voucher_id')
            ->where('v.company_id', $this->company->id)->where('a.step', 2)->where('a.approver_id', $this->supervisor->id)
            ->where('a.created_at', '>=', Carbon::now()->startOfMonth())->where('v.ai_anomaly_flag', true)
            ->groupBy('a.action')->selectRaw('a.action, COUNT(DISTINCT a.voucher_id) as n')->pluck('n', 'action');

        // Flags of the last 90 days that ended: approved or rejected (a flag cleared as a false alarm counts as "not rejected")
        $ended = Voucher::query()->where('company_id', $this->company->id)
            ->where('ai_checked_at', '>=', Carbon::now()->subDays(90))
            ->where(fn ($q) => $q->where('ai_anomaly_flag', true)->orWhereNotNull('ai_review_finding'))
            ->whereIn('status', [S::Approved->value, S::Rejected->value]);
        $endedTotal = (clone $ended)->count();
        $rejected = (clone $ended)->where('status', S::Rejected->value)->count();

        return [
            'open' => (clone $open)->count(),
            'on_hold' => number_format((float) (clone $open)->sum('vouchers.amount'), 2, '.', ''),
            'decided' => [
                'approved' => (int) ($decided['approved'] ?? 0),
                'rejected' => (int) ($decided['rejected'] ?? 0),
                'returned' => (int) ($decided['returned'] ?? 0),
            ],
            'accuracy' => [
                'ended' => $endedTotal,
                'rejected' => $rejected,
                'pct' => $endedTotal ? (int) round($rejected / $endedTotal * 100) : null,
            ],
            'needs_step2' => $this->route->aiFlaggedNeedsStep2(),
        ];
    }

    /** The payee's other submitted vouchers in this company (by payee id when linked, else by the exact name). */
    public function pastPayments(Voucher $v, int $limit = 5): array
    {
        if (! $v->payee_id && ! $v->payee_name) {
            return [];
        }

        return Voucher::query()->where('company_id', $this->company->id)->whereKeyNot($v->id)
            ->whereNotIn('status', [S::Draft->value, S::Cancelled->value])
            ->where(fn ($q) => $v->payee_id ? $q->where('payee_id', $v->payee_id) : $q->where('payee_name', $v->payee_name))
            ->orderByDesc('submitted_at')->orderByDesc('id')->limit($limit)
            ->get(['id', 'voucher_number', 'description', 'purpose', 'amount', 'status', 'submitted_at', 'approved_at'])
            ->map(fn (Voucher $p) => [
                'id' => $p->id,
                'voucher_number' => $p->voucher_number,
                'summary' => Str::limit((string) ($p->description ?: $p->purpose), 60) ?: null,
                'amount' => (string) $p->amount,
                'status' => $p->status,
                'submitted_at' => $p->submitted_at?->toIso8601String(),
            ])->all();
    }
}
