<?php

namespace App\Domain\Tenancy\Queries;

use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

/**
 * People & Access → Company access (code-first 2026-11-22). One company: the Admin's own.
 *
 * Who is listed: clerks / officers / supervisors who EITHER belong to this company (home company)
 * OR have an access row for it (e.g. someone from another company who was given access).
 * For each: their access to THIS company = accepted | pending | denied | none (no row),
 * who granted / changed it and when.
 *
 * Views: has_access (accepted) · no_access (pending, denied or none = can't open the company) ·
 *        other_companies (people whose home company is another one)
 */
class CompanyAccessDirectory
{
    public const VIEWS = ['has_access', 'no_access', 'other_companies'];

    public const SORTS = ['name', 'name_desc', 'recent'];

    public function __construct(private int $companyId) {}

    /** The people + their access columns for this company (access_status, access_changed_at, access_by_name). */
    public function base(?string $search = null): Builder
    {
        $row = fn (string $column) => DB::table('user_company_access')
            ->select($column)
            ->whereColumn('user_company_access.user_id', 'users.id')
            ->where('user_company_access.company_id', $this->companyId)
            ->limit(1);

        $query = User::query()
            ->select('users.*')
            ->whereIn('users.role', AccessCandidates::OPERATIONAL_ROLES)
            ->where(fn (Builder $q) => $q
                ->where('users.company_id', $this->companyId)
                ->orWhereExists(fn ($e) => $e->from('user_company_access')
                    ->whereColumn('user_company_access.user_id', 'users.id')
                    ->where('user_company_access.company_id', $this->companyId)))
            ->addSelect([
                'access_status' => $row('granted_status'),
                'access_changed_at' => $row('granted_at'),
                'access_by_name' => DB::table('user_company_access')
                    ->join('users as granter', 'granter.id', '=', 'user_company_access.granted_by')
                    ->selectRaw("TRIM(CONCAT(granter.first_name, ' ', granter.last_name))")
                    ->whereColumn('user_company_access.user_id', 'users.id')
                    ->where('user_company_access.company_id', $this->companyId)
                    ->limit(1),
            ])
            ->with(['department:id,name', 'company:id,name']);

        if ($search) {
            $like = '%'.addcslashes($search, '\\%_').'%';
            $query->where(fn (Builder $q) => $q
                ->where('users.first_name', 'like', $like)
                ->orWhere('users.last_name', 'like', $like)
                ->orWhereRaw("CONCAT(users.first_name, ' ', users.last_name) LIKE ?", [$like])
                ->orWhere('users.email', 'like', $like)
                ->orWhere('users.employee_id', 'like', $like));
        }

        return $query;
    }

    public function view(Builder $query, ?string $view): Builder
    {
        $accepted = fn ($e) => $e->from('user_company_access')
            ->whereColumn('user_company_access.user_id', 'users.id')
            ->where('user_company_access.company_id', $this->companyId)
            ->where('user_company_access.granted_status', 'accepted');

        return match ($view) {
            'has_access' => $query->whereExists($accepted),
            'no_access' => $query->whereNotExists($accepted),
            'other_companies' => $query->where('users.company_id', '!=', $this->companyId),
            default => $query,
        };
    }

    public function sort(Builder $query, ?string $sort): Builder
    {
        return match ($sort) {
            'name_desc' => $query->orderByDesc('users.first_name')->orderByDesc('users.last_name'),
            'recent' => $query->orderByRaw('access_changed_at IS NULL')->orderByDesc('access_changed_at'),
            default => $query->orderBy('users.first_name')->orderBy('users.last_name'),
        };
    }

    public function viewCounts(?string $search): array
    {
        $count = fn (?string $view) => $this->view($this->base($search), $view)->count();

        return [
            'all' => $count(null),
            'has_access' => $count('has_access'),
            'no_access' => $count('no_access'),
            'other_companies' => $count('other_companies'),
        ];
    }

    /** The cards. "can_be_granted" = what the Grant company access dialog will list. */
    public function summary(): array
    {
        return [
            'has_access' => $this->view($this->base(), 'has_access')->count(),
            'no_access' => $this->view($this->base(), 'no_access')->count(),
            'other_companies' => $this->view($this->base(), 'other_companies')->where('users.is_active', true)->count(),
            'can_be_granted' => AccessCandidates::query($this->companyId)->count(),
        ];
    }
}
