<?php

namespace App\Domain\Catalog\Payees;

use App\Models\Company;
use App\Models\Payee;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Query\Builder as QueryBuilder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * The Payees page (Framer jbj8yIDz9) for a clerk in the company in X-Company-ID.
 * The LIST is the company's (every clerk there shares it). The NUMBERS on it are the clerk's OWN vouchers
 * only (user decision 2026-11-26), the same rule as the rest of the clerk area:
 *   vouchers_count  submitted vouchers (not drafts, not cancelled)
 *   approved_ytd    total of approved vouchers this calendar year (money as a DECIMAL string)
 *   last_used_at    when the latest of them was submitted
 * Another company's payee is 404.
 */
class PayeeDirectory
{
    public const SORTS = ['most_used', 'name', 'recent', 'approved_desc'];

    public const STATUSES = ['active', 'inactive'];

    public function __construct(private User $clerk, private Company $company) {}

    public function base(): Builder
    {
        return Payee::query()->where('payees.company_id', $this->company->id);
    }

    /** $type: a payee type id, 'none' (no type) or null (all). */
    public function list(?string $status, ?string $type, ?string $search, ?string $sort): Builder
    {
        $q = $this->withStats($this->filtered($status, $type, $search))->with('type:id,name');

        return match ($sort) {
            'name' => $q->orderBy('payees.name'),
            'recent' => $q->orderByRaw('last_used_at IS NULL')->orderByDesc('last_used_at')->orderBy('payees.name'),
            'approved_desc' => $q->orderByDesc('approved_ytd')->orderBy('payees.name'),
            default => $q->orderByDesc('vouchers_count')->orderBy('payees.name'),
        };
    }

    public function filtered(?string $status, ?string $type, ?string $search): Builder
    {
        $q = $this->base()->where('payees.is_active', $status !== 'inactive');

        if ($type === 'none') {
            $q->whereNull('payees.payee_type_id');
        } elseif ($type) {
            $q->where('payees.payee_type_id', (int) $type);
        }

        if ($search) {
            $like = '%'.addcslashes($search, '\\%_').'%';
            $digits = preg_replace('/\D/', '', $search);
            $q->where(fn (Builder $w) => $w
                ->where('payees.name', 'like', $like)
                ->orWhere('payees.email', 'like', $like)
                // a TIN or account number typed with or without dashes / spaces
                ->when(strlen($digits) >= 3, fn ($x) => $x
                    ->orWhereRaw("REPLACE(payees.tin, '-', '') LIKE ?", ['%'.$digits.'%'])
                    ->orWhereRaw("REPLACE(REPLACE(payees.bank_account_number, '-', ''), ' ', '') LIKE ?", ['%'.$digits.'%'])));
        }

        return $q;
    }

    public function withStats(Builder $q): Builder
    {
        return $q->select('payees.*')
            ->selectSub($this->mine()->whereNotIn('status', ['draft', 'cancelled'])->selectRaw('COUNT(*)'), 'vouchers_count')
            ->selectSub($this->mine()->where('status', 'approved')
                ->whereRaw('COALESCE(approved_at, updated_at) >= ?', [Carbon::now()->startOfYear()])
                ->selectRaw('COALESCE(SUM(amount), 0)'), 'approved_ytd')
            ->selectSub($this->mine()->whereNotIn('status', ['draft', 'cancelled'])->selectRaw('MAX(COALESCE(submitted_at, created_at))'), 'last_used_at');
    }

    /** The type chips: active (or inactive) payees per type, plus 'all' and 'none'. */
    public function counts(?string $status): array
    {
        $rows = $this->base()->where('is_active', $status !== 'inactive')
            ->selectRaw('payee_type_id, COUNT(*) as n')->groupBy('payee_type_id')->pluck('n', 'payee_type_id');

        $types = DB::table('payee_types')->where('company_id', $this->company->id)->orderBy('name')->get(['id', 'name'])
            ->map(fn ($t) => ['id' => $t->id, 'name' => $t->name, 'count' => (int) ($rows[$t->id] ?? 0)]);

        return [
            'all' => (int) $rows->sum(),
            'none' => (int) ($rows[''] ?? 0),
            'types' => $types->all(),
            'active' => $this->base()->where('is_active', true)->count(),
            'inactive' => $this->base()->where('is_active', false)->count(),
        ];
    }

    public function find(int $id): Payee
    {
        return $this->withStats($this->base()->whereKey($id))->with(['type:id,name', 'creator:id,first_name,last_name'])->firstOrFail();
    }

    /** Side panel (Framer GZb92vr4M): average a month this year, the usual category and the 5 latest vouchers (all mine). */
    public function details(Payee $payee): array
    {
        $months = max(1, (int) Carbon::now()->month);
        $category = $this->mine($payee->id)->whereNotIn('vouchers.status', ['draft', 'cancelled'])
            ->join('voucher_categories as c', 'c.id', '=', 'vouchers.category_id')
            ->groupBy('c.id', 'c.name')->orderByRaw('COUNT(*) DESC')->value('c.name');

        $recent = $this->mine($payee->id)->orderByDesc('created_at')->orderByDesc('id')->limit(5)
            ->get(['id', 'voucher_number', 'status', 'amount', 'description', 'purpose', 'submitted_at', 'created_at']);

        return [
            'avg_per_month' => bcdiv((string) $payee->approved_ytd, (string) $months, 2),
            'usual_category' => $category,
            'recent' => $recent,
        ];
    }

    /** The clerk's own vouchers in this company for a payee (the outer `payees` row, or one id). */
    private function mine(?int $payeeId = null): QueryBuilder
    {
        $q = DB::table('vouchers')->where('vouchers.company_id', $this->company->id)->where('vouchers.created_by', $this->clerk->id);

        return $payeeId ? $q->where('vouchers.payee_id', $payeeId) : $q->whereColumn('vouchers.payee_id', 'payees.id');
    }
}
