<?php

namespace App\Domain\Tenancy\Queries;

use App\Models\Company;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

/**
 * QUERY CLASS for the Super Admin's Companies tab (Framer vnNFYExpX) and its click-flows
 * C2 (search), C3 (sort), C4 (list view) and C5 (Suspended filter).
 *
 * Only COUNTS and dates, never money: the Super Admin has no access to vouchers or budgets.
 *
 * Who counts as "a user of this company": everyone except Super Admins whose HOME company it is
 * (users.company_id, e.g. its Admin) or who was given access to it (user_company_access, accepted).
 * The same rule as the Super Admin dashboard's "users affected".
 */
class CompanyDirectory
{
    /** A company created in the last 30 days gets the "New" badge. */
    public const NEW_FOR_DAYS = 30;

    public function base(?string $search = null): Builder
    {
        $search = trim((string) $search);
        // % and _ are wildcards in LIKE; escape them so they match themselves
        $like = '%'.addcslashes($search, '\%_').'%';

        return Company::query()
            ->when($search !== '', fn (Builder $q) => $q->where(fn (Builder $w) => $w
                ->where('name', 'like', $like)
                ->orWhere('address', 'like', $like)));
    }

    /** The segmented views: All / Active / Suspended. */
    public function view(Builder $query, ?string $view): Builder
    {
        return match ($view) {
            'active' => $query->where('is_active', true),
            'suspended' => $query->whereNotNull('suspended_at'),
            default => $query,
        };
    }

    /** Adds users_count, departments_count, last_activity_at and the Admin in charge to each row. */
    public function withCardData(Builder $query): Builder
    {
        return $query
            ->select('companies.*')
            ->selectSub(self::usersCountSql(), 'users_count')
            ->selectSub('SELECT MAX(audit_logs.created_at) FROM audit_logs WHERE audit_logs.company_id = companies.id', 'last_activity_at')
            ->withCount('departments')
            ->with(['admins:id,first_name,last_name,company_id,is_active', 'suspendedBy:id,first_name,last_name']);
    }

    /**
     * C3 sort menu. "Suspended first" (the switch at the bottom of the menu) comes before the chosen
     * order. Ties are broken by name, then id, so pages never shuffle.
     */
    public function sort(Builder $query, string $sort = 'name', bool $suspendedFirst = false): Builder
    {
        if ($suspendedFirst) {
            $query->orderByRaw('suspended_at IS NULL');
        }

        match ($sort) {
            'name_desc' => $query->orderBy('name', 'desc'),
            'users' => $query->orderByDesc('users_count'),
            'departments' => $query->orderByDesc('departments_count'),
            // never-active companies go last
            'recent' => $query->orderByRaw('last_activity_at IS NULL')->orderByDesc('last_activity_at'),
            'newest' => $query->orderByDesc('created_at'),
            default => $query,
        };

        return $query->orderBy('name')->orderBy('id');
    }

    /** The numbers on the view tabs (they follow the search). */
    public function viewCounts(?string $search): array
    {
        return [
            'all' => $this->base($search)->count(),
            'active' => $this->view($this->base($search), 'active')->count(),
            'suspended' => $this->view($this->base($search), 'suspended')->count(),
        ];
    }

    /** The 4 summary cards (always the whole platform, not the search). */
    public function summary(): array
    {
        return [
            'total' => Company::count(),
            'active' => Company::where('is_active', true)->count(),
            'suspended' => Company::whereNotNull('suspended_at')->count(),
            'users' => User::where('role', '!=', 'super_admin')
                ->where(fn (Builder $q) => $q->whereNotNull('company_id')
                    ->orWhereHas('accessibleCompanies', fn (Builder $c) => $c->where('user_company_access.granted_status', 'accepted')))
                ->count(),
        ];
    }

    /** Everyone a suspension affects (see the class comment). */
    public static function usersOf(int $companyId): Builder
    {
        return User::query()
            ->where('role', '!=', 'super_admin')
            ->where(fn (Builder $q) => $q
                ->where('company_id', $companyId)
                ->orWhereHas('accessibleCompanies', fn (Builder $c) => $c
                    ->where('companies.id', $companyId)
                    ->where('user_company_access.granted_status', 'accepted')));
    }

    /** The same count as usersOf(), as a sub-query for every row of the list at once. */
    private static function usersCountSql(): string
    {
        return "SELECT COUNT(*) FROM users WHERE users.role <> 'super_admin' AND (users.company_id = companies.id OR EXISTS ("
            ."SELECT 1 FROM user_company_access uca WHERE uca.user_id = users.id AND uca.company_id = companies.id AND uca.granted_status = 'accepted'))";
    }

    /** Used by the dialogs ("54 users are signed out…"). */
    public static function usersCount(int $companyId): int
    {
        return self::usersOf($companyId)->count();
    }
}
