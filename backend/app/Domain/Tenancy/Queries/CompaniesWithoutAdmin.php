<?php

namespace App\Domain\Tenancy\Queries;

use App\Models\Company;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;

/**
 * Companies that can be given an Admin right now (2026-11-28): active, not suspended, and nobody active runs them.
 * The same rule as AssignCompanyAdmin::handle() checks when saving. Used by "Assign to a company" on the Admins tab.
 */
class CompaniesWithoutAdmin
{
    public static function query(): Builder
    {
        return Company::query()
            ->where('is_active', true)
            ->whereNull('suspended_at')
            ->whereDoesntHave('admins', fn (Builder $q) => $q->where('is_active', true));
    }

    /** A–Z, with the people count (a picker, at most 200). */
    public function list(): Collection
    {
        return self::query()
            ->withCount(['users as users_count' => fn (Builder $q) => $q->where('role', '!=', 'super_admin')])
            ->orderBy('name')->orderBy('id')
            ->limit(200)
            ->get(['id', 'name', 'type', 'address']);
    }
}
