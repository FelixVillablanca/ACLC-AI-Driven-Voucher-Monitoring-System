<?php

namespace App\Domain\Identity\Queries;

use App\Domain\Tenancy\Queries\CompanyDirectory;
use App\Models\Department;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;

/**
 * The Admin top-bar search. SCOPE RULE (since 2026-11-20 each Admin runs ONE company):
 * it only ever looks inside the Admin's own company (`users.company_id`):
 *   - users:       people of that company (home company, or accepted access), never Super Admins
 *   - departments: that company's departments
 * Other companies are never searched, so their names can't leak through the search box.
 * An Admin with no company gets empty results.
 */
class AdminSearch
{
    public const LIMIT = 5; // per group: it's a quick-find dropdown, not a list page

    /** @return array{users: Collection<int, User>, departments: Collection<int, Department>} */
    public function run(User $admin, string $term): array
    {
        $companyId = $admin->company_id;

        if (! $companyId) {
            return ['users' => collect(), 'departments' => collect()];
        }

        $like = '%'.self::escapeLike($term).'%';

        $users = CompanyDirectory::usersOf($companyId)
            ->where(fn (Builder $q) => $q
                ->where('first_name', 'like', $like)
                ->orWhere('last_name', 'like', $like)
                ->orWhereRaw("CONCAT(first_name, ' ', last_name) LIKE ?", [$like])
                ->orWhere('email', 'like', $like)
                ->orWhere('employee_id', 'like', $like))
            ->with(['department' => fn ($q) => $q->select('id', 'name')])
            ->orderBy('first_name')
            ->orderBy('last_name')
            ->limit(self::LIMIT)
            ->get();

        $departments = Department::query()
            ->where('company_id', $companyId)
            ->where(fn (Builder $q) => $q->where('name', 'like', $like)->orWhere('code', 'like', $like))
            ->with(['head' => fn ($q) => $q->select('id', 'first_name', 'last_name')])
            ->withCount('users')
            ->orderBy('name')
            ->limit(self::LIMIT)
            ->get();

        return ['users' => $users, 'departments' => $departments];
    }

    /** "50%" or "a_b" must be searched as typed, not as LIKE wildcards. */
    private static function escapeLike(string $value): string
    {
        return addcslashes($value, '\\%_');
    }
}
