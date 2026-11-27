<?php

namespace App\Domain\Approvals\Queries;

use App\Domain\AI\Anomaly\RuleBasedAnomalyCheck;
use App\Domain\Platform\SystemSettings;
use App\Domain\Vouchers\VoucherStatus as S;
use App\Models\Company;
use App\Models\Voucher;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Flagged vouchers (Framer dtNDyUAUp list, YX1IiDXMp investigate) for the company in X-Company-ID.
 * The list = vouchers still waiting for Accounting with a flag nobody has reviewed, highest score first.
 * Stats this month: flagged, confirmed issues (returned with "Needs changes" or rejected after a flag,
 * and the money they held back), cleared as false alarms, and the current threshold.
 */
class FlaggedVouchers
{
    public function __construct(private Company $company, private RuleBasedAnomalyCheck $check, private SystemSettings $settings) {}

    public function waiting(): Builder
    {
        return Voucher::query()->where('company_id', $this->company->id)->where('status', S::Pending->value)
            ->where('ai_anomaly_flag', true)->whereNull('ai_review_finding');
    }

    public function list(): Builder
    {
        return $this->waiting()->select('vouchers.*')
            ->addSelect([
                'clerk_first' => DB::table('users')->select('first_name')->whereColumn('users.id', 'vouchers.created_by'),
                'clerk_last' => DB::table('users')->select('last_name')->whereColumn('users.id', 'vouchers.created_by'),
                'department_name' => DB::table('departments')->select('name')->whereColumn('departments.id', 'vouchers.department_id'),
            ])
            ->with('category:id,name')
            ->orderByDesc('ai_anomaly_score')->orderBy('submitted_at');
    }

    public function stats(): array
    {
        $from = Carbon::now()->startOfMonth();
        $flagged = Voucher::query()->where('company_id', $this->company->id)->where('ai_checked_at', '>=', $from)
            ->where(fn ($q) => $q->where('ai_anomaly_flag', true)->orWhereNotNull('ai_review_finding'));

        $confirmed = (clone $flagged)->where(fn ($q) => $q->where('ai_review_finding', 'needs_changes')
            ->orWhere(fn ($r) => $r->where('status', S::Rejected->value)->where('ai_anomaly_flag', true)));

        return [
            'flagged_this_month' => (clone $flagged)->count(),
            'confirmed' => (clone $confirmed)->count(),
            'confirmed_amount' => (string) (clone $confirmed)->toBase()->selectRaw('COALESCE(SUM(amount), 0) as t')->value('t'),
            'cleared' => (clone $flagged)->where('ai_review_finding', 'false_alarm')->count(),
            'threshold' => $this->check->threshold(),
            'sensitivity' => $this->settings->value(SystemSettings::ANOMALY_SENSITIVITY),
            'waiting' => $this->waiting()->count(),
        ];
    }

    /** The Investigate page: the 6-month chart, the stored signals and a plain-language summary. */
    public function investigation(Voucher $v): array
    {
        $history = $this->check->history($v);
        $spent = array_filter($history, fn ($m) => bccomp($m['total'], '0', 2) > 0);
        $average = $spent ? bcdiv(array_reduce($spent, fn ($c, $m) => bcadd($c, $m['total'], 2), '0'), (string) count($spent), 2) : null;
        $signals = $v->ai_check_signals ?? [];

        return [
            'category' => $v->category?->name,
            'department' => $v->department_id ? DB::table('departments')->where('id', $v->department_id)->value('name') : null,
            'history' => $history,
            'average' => $average,
            'months_with_spending' => count($spent),
            'signals' => $signals,
            'summary' => $this->summary($signals),
            'tags' => $this->tags($signals),
        ];
    }

    /** "Unusual amount", "Possible duplicate", "Budget at 92%"… for the list cards. */
    public function tags(array $signals): array
    {
        return array_values(array_map(fn ($s) => [
            'label' => $s['key'] === 'budget' ? "Budget at {$s['after_pct']}%" : (RuleBasedAnomalyCheck::TAGS[$s['key']] ?? $s['label']),
            'impact' => $s['impact'],
        ], array_filter($signals, fn ($s) => in_array($s['impact'], ['high', 'medium'], true))));
    }

    /** A few factual sentences from the signals (not AI): what stands out, then what looks normal. */
    private function summary(array $signals): ?string
    {
        if (! $signals) {
            return null;
        }
        $by = collect($signals)->keyBy('key');
        $parts = [];
        if (in_array($by['amount']['impact'] ?? null, ['high', 'medium'], true)) {
            $parts[] = "The total is {$by['amount']['ratio']}× this department's average month for the category ({$by['amount']['normal']} in recent months).";
        }
        if (($by['duplicate']['impact'] ?? null) === 'high') {
            $parts[] = "A voucher to the same payee for a similar amount already exists ({$by['duplicate']['value']}): check the period and the reference.";
        }
        if (($by['category']['impact'] ?? null) === 'medium') {
            $parts[] = "The category “{$by['category']['value']}” is unusual for this payee ({$by['category']['normal']}).";
        }
        if (in_array($by['budget']['impact'] ?? null, ['high', 'medium'], true)) {
            $parts[] = "Approving it would bring the department's budget to {$by['budget']['value']} this month.";
        }
        if (($by['payee']['impact'] ?? null) === 'medium') {
            $parts[] = 'It is the first voucher to this payee, and a large one.';
        }
        $calm = [];
        if (($by['payee']['impact'] ?? null) === 'low' && ($by['payee']['normal'] ?? '') === 'Known payee' && $by['payee']['value'] !== 'First voucher') {
            $calm[] = "the payee is known ({$by['payee']['value']})";
        }
        if (($by['duplicate']['impact'] ?? null) === 'low') {
            $calm[] = 'no similar voucher in 45 days';
        }
        if ($calm) {
            $parts[] = ucfirst(implode(' and ', $calm)).'.';
        }

        return $parts ? implode(' ', $parts) : null;
    }
}
