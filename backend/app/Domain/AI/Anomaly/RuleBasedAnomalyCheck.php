<?php

namespace App\Domain\AI\Anomaly;

use App\Domain\Budgets\Support\FiscalYear;
use App\Domain\Platform\SystemSettings;
use App\Domain\Vouchers\VoucherStatus as S;
use App\Models\Company;
use App\Models\Voucher;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * THE AUTOMATIC CHECK (user decision 2026-11-27): plain rules, NOT AI, until Phase 5's ML model replaces
 * the score. It looks at five signals; each has an impact and a weight:
 *   amount     the total vs the department's average month for this category (last 6 full months)
 *                ≥ 2× → high (0.65) · ≥ 1.5× → medium (0.35)          needs 3+ months with spending
 *   duplicate  same payee, total within 10%, submitted in the 45 days BEFORE this one → high (0.70)
 *              (only earlier vouchers: the first of two look-alikes isn't the duplicate)
 *   category   the payee has 3+ vouchers and under 20% used this category → medium (0.45)
 *   budget     this month's department budget after this voucher: over 100% → high (0.35) · past the alert → medium (0.15)
 *   payee      a payee never paid before and ₱20,000 or more → medium (0.30)
 * score = 1 − Π(1 − weight)  (two medium signals add up; one high one is enough).
 * Flagged when score ≥ the threshold for the Super Admin's sensitivity: relaxed 0.70 · balanced 0.60 · strict 0.45.
 */
class RuleBasedAnomalyCheck
{
    public const THRESHOLDS = ['relaxed' => 0.70, 'balanced' => 0.60, 'strict' => 0.45];

    public const TAGS = [
        'amount' => 'Unusual amount',
        'duplicate' => 'Possible duplicate',
        'category' => 'Category mismatch',
        'budget' => 'Budget',
        'payee' => 'New payee',
    ];

    public function __construct(private SystemSettings $settings) {}

    public function threshold(): float
    {
        return self::THRESHOLDS[$this->settings->value(SystemSettings::ANOMALY_SENSITIVITY)] ?? self::THRESHOLDS['balanced'];
    }

    /** @return array{score: float, flagged: bool, reason: ?string, signals: list<array<string, mixed>>} */
    public function check(Voucher $v): array
    {
        $signals = array_values(array_filter([
            $this->amount($v),
            $this->duplicate($v),
            $this->category($v),
            $this->budget($v),
            $this->payee($v),
        ]));

        $keep = 1.0;
        foreach ($signals as $s) {
            $keep *= 1 - $s['weight'];
        }
        $score = round(min(0.99, 1 - $keep), 2);
        $top = collect($signals)->where('weight', '>', 0)->sortByDesc('weight')->first();

        return [
            'score' => $score,
            'flagged' => $score >= $this->threshold(),
            'reason' => $top['reason'] ?? null,
            'signals' => $signals,
        ];
    }

    /** Monthly totals (approved) for the voucher's department + category: the 6 full months before it. */
    public function history(Voucher $v): array
    {
        $end = ($v->submitted_at ?? now())->copy()->startOfMonth();
        $start = $end->copy()->subMonths(6);
        $rows = DB::table('vouchers')->where('company_id', $v->company_id)->where('category_id', $v->category_id)
            ->when($v->department_id, fn ($q) => $q->where('department_id', $v->department_id), fn ($q) => $q->whereNull('department_id'))
            ->where('status', S::Approved->value)->where('id', '!=', $v->id)
            ->whereRaw('COALESCE(approved_at, submitted_at) >= ? AND COALESCE(approved_at, submitted_at) < ?', [$start, $end])
            ->selectRaw("DATE_FORMAT(COALESCE(approved_at, submitted_at), '%Y-%m') as ym, SUM(amount) as total")
            ->groupBy('ym')->pluck('total', 'ym');

        $months = [];
        for ($m = $start->copy(); $m < $end; $m->addMonth()) {
            $months[] = ['month' => $m->format('Y-m'), 'label' => $m->format('M'), 'total' => (string) ($rows[$m->format('Y-m')] ?? '0.00')];
        }

        return $months;
    }

    private function amount(Voucher $v): ?array
    {
        $months = $this->history($v);
        $spent = array_filter($months, fn ($m) => bccomp($m['total'], '0', 2) > 0);
        if (count($spent) < 3) {
            return $this->signal('amount', 'Amount vs department history', $this->money($v->amount), 'Not enough history', 'none', 0, null);
        }
        $avg = bcdiv(array_reduce($spent, fn ($c, $m) => bcadd($c, $m['total'], 2), '0'), (string) count($spent), 2);
        $ratio = bccomp($avg, '0', 2) > 0 ? (float) bcdiv((string) $v->amount, $avg, 2) : 0.0;
        $totals = array_map(fn ($m) => (float) $m['total'], $spent);
        $normal = $this->money((string) min($totals), true).' – '.$this->money((string) max($totals), true);
        [$impact, $weight] = $ratio >= 2 ? ['high', 0.65] : ($ratio >= 1.5 ? ['medium', 0.35] : ['low', 0]);
        $category = DB::table('voucher_categories')->where('id', $v->category_id)->value('name') ?? 'this category';
        $dept = $v->department_id ? DB::table('departments')->where('id', $v->department_id)->value('name') : 'vouchers without a department';

        return $this->signal('amount', 'Amount vs department history', $this->money($v->amount), $normal, $impact, $weight,
            $weight ? "Amount is {$ratio}× the 6-month average for {$category} in {$dept}." : null, ['average' => $avg, 'ratio' => $ratio]);
    }

    private function duplicate(Voucher $v): ?array
    {
        if (! $v->payee_name || bccomp((string) $v->amount, '0', 2) <= 0) {
            return null;
        }
        $other = DB::table('vouchers')->where('company_id', $v->company_id)->where('id', '!=', $v->id)
            ->whereNotIn('status', [S::Draft->value, S::Cancelled->value, S::Rejected->value])
            ->where(fn ($w) => $v->payee_id
                ? $w->where('payee_id', $v->payee_id)->orWhereRaw('LOWER(payee_name) = ?', [mb_strtolower($v->payee_name)])
                : $w->whereRaw('LOWER(payee_name) = ?', [mb_strtolower($v->payee_name)]))
            ->whereBetween('amount', [bcmul((string) $v->amount, '0.90', 2), bcmul((string) $v->amount, '1.10', 2)])
            ->where('submitted_at', '>=', ($v->submitted_at ?? now())->copy()->subDays(45))
            ->where(fn ($w) => $w->where('submitted_at', '<', $v->submitted_at ?? now())
                ->orWhere(fn ($same) => $same->where('submitted_at', $v->submitted_at ?? now())->where('id', '<', $v->id)))
            ->orderByDesc('submitted_at')->first(['voucher_number', 'status', 'submitted_at', 'approved_at']);

        if (! $other) {
            return $this->signal('duplicate', 'Same payee, similar amount', 'None in 45 days', 'None', 'low', 0, null);
        }
        $when = Carbon::parse($other->approved_at ?? $other->submitted_at);
        $days = (int) $when->copy()->startOfDay()->diffInDays(now()->startOfDay());
        $verb = $other->status === S::Approved->value ? 'approved' : 'submitted';
        $ago = $days === 0 ? 'today' : ($days === 1 ? 'yesterday' : "{$days} days ago");

        return $this->signal('duplicate', 'Same payee, similar amount', $other->voucher_number, 'None', 'high', 0.70,
            "Same payee and similar amount {$verb} {$ago} ({$other->voucher_number}).");
    }

    private function category(Voucher $v): ?array
    {
        if (! $v->payee_name) {
            return null;
        }
        $rows = DB::table('vouchers as x')->join('voucher_categories as c', 'c.id', '=', 'x.category_id')
            ->where('x.company_id', $v->company_id)->where('x.id', '!=', $v->id)
            ->whereNotIn('x.status', [S::Draft->value, S::Cancelled->value])
            ->whereRaw('LOWER(x.payee_name) = ?', [mb_strtolower($v->payee_name)])
            ->selectRaw('x.category_id, c.name, COUNT(*) as n')->groupBy('x.category_id', 'c.name')->orderByDesc('n')->get();
        $total = (int) $rows->sum('n');
        if ($total < 3) {
            return null;
        }
        $same = (int) ($rows->firstWhere('category_id', $v->category_id)->n ?? 0);
        $usual = $rows->first()->name;
        $mine = DB::table('voucher_categories')->where('id', $v->category_id)->value('name');
        if ($same / $total >= 0.2) {
            return $this->signal('category', 'Category vs payee history', $mine, "Usually {$usual}", 'low', 0, null);
        }

        return $this->signal('category', 'Category vs payee history', $mine, "Usually {$usual}", 'medium', 0.45,
            "Category “{$mine}” doesn't match the payee's history (usually {$usual}).");
    }

    private function budget(Voucher $v): ?array
    {
        if (! $v->department_id) {
            return null;
        }
        $company = Company::find($v->company_id);
        $row = $company ? DB::table('budget_allocations')->where('company_id', $v->company_id)->where('department_id', $v->department_id)
            ->where('fiscal_year', FiscalYear::current($company))->first() : null; // yearly budgets (2026-11-27)
        if (! $row || bccomp((string) $row->total_budget, '0', 2) <= 0) {
            return null;
        }
        $after = (float) bcdiv(bcmul(bcadd((string) $row->used_amount, (string) $v->amount, 2), '100', 4), (string) $row->total_budget, 0);
        $alert = (float) $row->alert_threshold_pct;
        [$impact, $weight] = $after >= 100 ? ['high', 0.35] : ($after >= $alert ? ['medium', 0.15] : ['low', 0]);

        return $this->signal('budget', 'Budget used after approval', "{$after}%", 'Alert at '.rtrim(rtrim((string) $alert, '0'), '.').'%', $impact, $weight,
            $weight ? "It would bring the department's budget to {$after}% for the year." : null, ['after_pct' => $after]);
    }

    private function payee(Voucher $v): ?array
    {
        if (! $v->payee_name) {
            return null;
        }
        $past = DB::table('vouchers')->where('company_id', $v->company_id)->where('id', '!=', $v->id)
            ->whereNotIn('status', [S::Draft->value, S::Cancelled->value])
            ->whereRaw('LOWER(payee_name) = ?', [mb_strtolower($v->payee_name)])->count();
        if ($past > 0) {
            return $this->signal('payee', 'Payee history', $past.' past '.($past === 1 ? 'voucher' : 'vouchers'), 'Known payee', 'low', 0, null);
        }
        $big = bccomp((string) $v->amount, '20000', 2) >= 0;

        return $this->signal('payee', 'Payee history', 'First voucher', 'Known payee', $big ? 'medium' : 'low', $big ? 0.30 : 0,
            $big ? 'A large first payment to a payee this company has never paid.' : null);
    }

    private function signal(string $key, string $label, ?string $value, string $normal, string $impact, float $weight, ?string $reason, array $extra = []): array
    {
        return ['key' => $key, 'label' => $label, 'value' => $value, 'normal' => $normal, 'impact' => $impact, 'weight' => $weight, 'reason' => $reason] + $extra;
    }

    private function money(string|float|null $amount, bool $short = false): string
    {
        $n = (float) $amount;
        if ($short && $n >= 1000) {
            return '₱'.rtrim(rtrim(number_format($n / 1000, 1), '0'), '.').'k';
        }

        return '₱'.number_format($n, 2);
    }
}
