<?php

namespace App\Domain\Identity\Queries;

use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

/**
 * People & Access → Users (code-first 2026-11-22): the clerks, officers and supervisors whose
 * HOME company is the Admin's company. Admin accounts are managed by the Super Admin, and
 * people from other companies are never listed; opening one by id gives 404 (find()).
 *
 * Status uses the one shared rule (User::accountStatus / withAccountStatus):
 *   active = signed in at least once · pending = never signed in · inactive = deactivated
 */
class CompanyUserDirectory
{
    public const ROLES = ['accounting_clerk', 'accounting_officer', 'supervisor_manager'];

    public const VIEWS = ['active', 'pending', 'inactive'];

    public const SORTS = ['name', 'name_desc', 'newest', 'last_sign_in'];

    public function __construct(private int $companyId) {}

    public function base(?string $search = null): Builder
    {
        $query = User::query()->where('company_id', $this->companyId)->whereIn('role', self::ROLES);

        if ($search) {
            $like = '%'.addcslashes($search, '\\%_').'%';
            $query->where(fn (Builder $q) => $q
                ->where('first_name', 'like', $like)
                ->orWhere('last_name', 'like', $like)
                ->orWhereRaw("CONCAT(first_name, ' ', last_name) LIKE ?", [$like])
                ->orWhere('email', 'like', $like)
                ->orWhere('employee_id', 'like', $like));
        }

        return $query;
    }

    /** View tab, role and department filters. $department = an id, or 'none' for "No department". */
    public function filter(Builder $query, ?string $view, ?string $role, int|string|null $department): Builder
    {
        if ($view) {
            $query->withAccountStatus($view);
        }
        if ($role) {
            $query->where('role', $role);
        }
        if ($department === 'none') {
            $query->whereNull('department_id');
        } elseif ($department) {
            $query->where('department_id', (int) $department);
        }

        return $query;
    }

    public function withRowData(Builder $query): Builder
    {
        return $query->with(['department:id,name,code,is_active']);
    }

    public function sort(Builder $query, ?string $sort): Builder
    {
        return match ($sort) {
            'name_desc' => $query->orderByDesc('first_name')->orderByDesc('last_name'),
            'newest' => $query->orderByDesc('created_at')->orderByDesc('id'),
            'last_sign_in' => $query->orderByRaw('last_login_at IS NULL')->orderByDesc('last_login_at'),
            default => $query->orderBy('first_name')->orderBy('last_name'),
        };
    }

    /** The numbers on the view tabs (they follow the search, role and department filters). */
    public function viewCounts(?string $search, ?string $role, int|string|null $department): array
    {
        $count = fn (?string $view) => $this->filter($this->base($search), $view, $role, $department)->count();

        return ['all' => $count(null), 'active' => $count('active'), 'pending' => $count('pending'), 'inactive' => $count('inactive')];
    }

    /** The cards at the top of the page. */
    public function summary(): array
    {
        $count = fn (callable $scope) => $scope($this->base())->count();

        return [
            'total' => $count(fn ($q) => $q),
            'active' => $count(fn ($q) => $q->withAccountStatus('active')),
            'pending' => $count(fn ($q) => $q->withAccountStatus('pending')),
            'inactive' => $count(fn ($q) => $q->withAccountStatus('inactive')),
            'without_department' => $count(fn ($q) => $q->where('is_active', true)->whereNull('department_id')),
            'by_role' => collect(self::ROLES)->mapWithKeys(fn ($r) => [$r => $count(fn ($q) => $q->where('role', $r))])->all(),
        ];
    }

    /** One person of THIS company (clerk / officer / supervisor), or 404. */
    public function find(int $id): User
    {
        return $this->withRowData($this->base())->findOrFail($id);
    }
}
