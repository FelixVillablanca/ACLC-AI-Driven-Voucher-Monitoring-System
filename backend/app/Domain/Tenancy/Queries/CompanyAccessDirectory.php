<?php

namespace App\Domain\Tenancy\Queries;

use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

/**
 * People & Access → Company access. One company: the Admin's own.
 * Split in two (user decision 2026-11-22):
 *
 *   in_company        clerks / officers / supervisors whose HOME company is this one, with their access
 *                     to it (accepted | pending | denied | none) → filter[access]=has|none
 *   other_companies   people of OTHER companies who WORK here (accepted access). They're shown with their
 *                     work email and role only (CompanyAccessRowResource); their home Admin manages them.
 *
 * Open invites and requests are on their own tab (CrossCompanyDirectory::pending).
 */
class CompanyAccessDirectory
{
    public const VIEWS = ['in_company', 'other_companies'];

    public const ACCESS = ['has', 'none'];

    public const SORTS = ['name', 'name_desc', 'recent'];

    public function __construct(private int $companyId) {}

    /** One view's people + their access columns for this company (access_status, access_changed_at, access_by_name). */
    public function base(string $view = 'in_company', ?string $search = null): Builder
    {
        $row = fn (string $column) => DB::table('user_company_access')
            ->select($column)
            ->whereColumn('user_company_access.user_id', 'users.id')
            ->where('user_company_access.company_id', $this->companyId)
            ->limit(1);

        $query = User::query()
            ->select('users.*')
            ->whereIn('users.role', AccessCandidates::OPERATIONAL_ROLES)
            ->addSelect([
                'access_status' => $row('granted_status'),
                'access_kind' => $row('kind'),
                'access_changed_at' => $row('granted_at'),
                'access_by_name' => DB::table('user_company_access')
                    ->join('users as granter', 'granter.id', '=', DB::raw('COALESCE(user_company_access.responded_by, user_company_access.granted_by, user_company_access.requested_by)'))
                    ->selectRaw("TRIM(CONCAT(granter.first_name, ' ', granter.last_name))")
                    ->whereColumn('user_company_access.user_id', 'users.id')
                    ->where('user_company_access.company_id', $this->companyId)
                    ->limit(1),
            ])
            ->with(['department:id,name', 'company:id,name']);

        if ($view === 'other_companies') {
            $query->where('users.company_id', '!=', $this->companyId)
                ->whereExists($this->accepted());
        } else {
            $query->where('users.company_id', $this->companyId);
        }

        if ($search) {
            $like = '%'.addcslashes($search, '\\%_').'%';
            $query->where(fn (Builder $q) => $q
                ->where('users.first_name', 'like', $like)
                ->orWhere('users.last_name', 'like', $like)
                ->orWhereRaw("CONCAT(users.first_name, ' ', users.last_name) LIKE ?", [$like])
                ->orWhere('users.email', 'like', $like)
                // employee IDs belong to the home company: only searchable for this company's own people
                ->when($view === 'in_company', fn ($w) => $w->orWhere('users.employee_id', 'like', $like)));
        }

        return $query;
    }

    /** filter[access] on the In your company view: has = can open it, none = can't yet. */
    public function access(Builder $query, ?string $access): Builder
    {
        return match ($access) {
            'has' => $query->whereExists($this->accepted()),
            'none' => $query->whereNotExists($this->accepted()),
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

    /** The tab numbers (they follow the search). */
    public function viewCounts(?string $search): array
    {
        return [
            'in_company' => $this->base('in_company', $search)->count(),
            'other_companies' => $this->base('other_companies', $search)->count(),
            'requests' => $this->pendingCount('request'),
        ];
    }

    /** The cards. */
    public function summary(): array
    {
        return [
            'has_access' => $this->access($this->base('in_company'), 'has')->count(),
            'no_access' => $this->access($this->base('in_company'), 'none')->count(),
            'other_companies' => $this->base('other_companies')->count(),
            'requests' => $this->pendingCount('request'),
            'invites' => $this->pendingCount('invite'),
            'can_be_granted' => AccessCandidates::query($this->companyId)->count(),
        ];
    }

    private function accepted(): \Closure
    {
        return fn ($e) => $e->from('user_company_access')
            ->whereColumn('user_company_access.user_id', 'users.id')
            ->where('user_company_access.company_id', $this->companyId)
            ->where('user_company_access.granted_status', 'accepted');
    }

    private function pendingCount(string $kind): int
    {
        return DB::table('user_company_access')->where('company_id', $this->companyId)
            ->where('granted_status', 'pending')->where('kind', $kind)->count();
    }
}
