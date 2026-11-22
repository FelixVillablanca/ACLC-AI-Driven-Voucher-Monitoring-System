<?php

namespace App\Domain\Tenancy\Queries;

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
    public function find(int $id): Department
    {
        return Department::where('company_id', $this->companyId)->findOrFail($id);
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
