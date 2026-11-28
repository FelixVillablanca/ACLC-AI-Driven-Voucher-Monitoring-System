<?php

namespace App\Domain\Tenancy\Queries;

use App\Domain\Identity\Queries\CompanyUserDirectory;
use App\Models\Department;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

/**
 * The Admin's Departments page (Organization → Departments, code-first 2026-11-22).
 * Always ONE company: the Admin's own. Another company's department is never listed, and
 * opening one by id gives 404 (DepartmentDirectory::find).
 *
 * People "in" a department = users.department_id (never Super Admins).
 */
class DepartmentDirectory
{
    public const VIEWS = ['active', 'inactive', 'no_head'];

    public const SORTS = ['name', 'name_desc', 'people', 'newest'];

    public function __construct(private int $companyId) {}

    /** The company's departments, matching the search (name, code or the head's name). */
    public function base(?string $search = null): Builder
    {
        $query = Department::query()->where('departments.company_id', $this->companyId);

        if ($search) {
            $like = '%'.addcslashes($search, '\\%_').'%';
            $query->where(fn (Builder $q) => $q
                ->where('departments.name', 'like', $like)
                ->orWhere('departments.code', 'like', $like)
                ->orWhereHas('head', fn (Builder $h) => $h
                    ->where('first_name', 'like', $like)
                    ->orWhere('last_name', 'like', $like)
                    ->orWhereRaw("CONCAT(first_name, ' ', last_name) LIKE ?", [$like])));
        }

        return $query;
    }

    public function view(Builder $query, ?string $view): Builder
    {
        return match ($view) {
            'active' => $query->where('departments.is_active', true),
            'inactive' => $query->where('departments.is_active', false),
            'no_head' => $query->where('departments.is_active', true)->whereNull('departments.head_user_id'),
            default => $query,
        };
    }

    /** Adds people_count and the head's name to each row. */
    public function withRowData(Builder $query): Builder
    {
        return $query
            ->with(['head:id,first_name,last_name,is_active'])
            ->withCount(['users as people_count' => fn (Builder $q) => $q->where('role', '!=', 'super_admin')]);
    }

    public function sort(Builder $query, ?string $sort): Builder
    {
        return match ($sort) {
            'name_desc' => $query->orderByDesc('departments.name'),
            'people' => $query->orderByDesc('people_count')->orderBy('departments.name'),
            'newest' => $query->orderByDesc('departments.created_at')->orderByDesc('departments.id'),
            default => $query->orderBy('departments.name'),
        };
    }

    /** The numbers on the view tabs (they follow the search). */
    public function viewCounts(?string $search): array
    {
        return [
            'all' => $this->base($search)->count(),
            'active' => $this->view($this->base($search), 'active')->count(),
            'inactive' => $this->view($this->base($search), 'inactive')->count(),
            'no_head' => $this->view($this->base($search), 'no_head')->count(),
        ];
    }

    /** The 4 cards at the top of the page. */
    public function summary(): array
    {
        $all = Department::where('company_id', $this->companyId);

        return [
            'total' => (clone $all)->count(),
            'active' => (clone $all)->where('is_active', true)->count(),
            'without_head' => (clone $all)->where('is_active', true)->whereNull('head_user_id')->count(),
            // people of this company who aren't in any department yet
            'people_without_department' => User::where('company_id', $this->companyId)
                ->whereIn('role', AccessCandidates::OPERATIONAL_ROLES)
                ->where('is_active', true)
                ->whereNull('department_id')
                ->count(),
        ];
    }

    /** One department of THIS company, or 404 (also for another company's id). */
    /** One department with the same data as a list row (people count, head): the side panel. */
    public function detail(int $id): Department
    {
        return $this->withRowData($this->base()->whereKey($this->find($id)->id))->firstOrFail();
    }

    public function find(int $id): Department
    {
        return Department::where('company_id', $this->companyId)->findOrFail($id);
    }

    /**
     * "Add people" picker (2026-11-28): active clerks / officers / supervisors of the company who aren't in this
     * department yet, A–Z, at most 50, with their current department (they'd be moved) and whether they head it.
     */
    public function candidates(Department $department, ?string $search = null)
    {
        $like = $search ? '%'.addcslashes($search, '%_\\').'%' : null;

        return User::query()
            ->where('company_id', $this->companyId)
            ->whereIn('role', CompanyUserDirectory::ROLES)
            ->where('is_active', true)->where('access_status', '!=', 'rejected')
            ->where(fn ($q) => $q->whereNull('department_id')->orWhere('department_id', '!=', $department->id))
            ->when($like, fn ($q) => $q->where(fn ($q) => $q->whereRaw("CONCAT(first_name, ' ', last_name) LIKE ?", [$like])
                ->orWhere('email', 'like', $like)->orWhere('employee_id', 'like', $like)))
            ->with('department:id,name,head_user_id')
            ->orderBy('first_name')->orderBy('last_name')->orderBy('id')
            ->limit(50)
            ->get();
    }

    /** How many active operational users the company has (no users = a department can't have a head). */
    public function activeUsersCount(): int
    {
        return User::query()->where('company_id', $this->companyId)
            ->whereIn('role', CompanyUserDirectory::ROLES)->where('is_active', true)->count();
    }

    /** The people in one department, A–Z, 20 a page (the side panel). */
    public function members(Department $department, int $perPage = 20)
    {
        return User::where('department_id', $department->id)
            ->where('role', '!=', 'super_admin')
            ->orderBy('first_name')->orderBy('last_name')
            ->paginate($perPage);
    }
}
