<?php

namespace App\Domain\Reporting\Queries;

use App\Domain\Audit\AuditCatalog;
use App\Domain\Audit\Queries\AuditLogSearch;
use App\Domain\Identity\Queries\CompanyUserDirectory;
use App\Domain\Tenancy\Queries\AccessCandidates;
use App\Models\Company;
use App\Models\Department;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * QUERY CLASS = one class whose only job is to READ and summarise data
 * (it never changes anything). This one builds the numbers for the
 * admin dashboard (Framer Nhw7N27tM) for the Admin's OWN company only
 * (since 2026-11-20 each Admin runs exactly one company, users.company_id).
 *
 * Every number is a COUNT done by the database, so it stays fast even with
 * thousands of rows (we never load every row into PHP just to count it).
 *
 * Polished 2026-11-22: each number uses the SAME rule as the page it links to, so the dashboard and
 * the page always agree: users = the Users page (clerks / officers / supervisors of this company),
 * users without access = the Company access page ("can be granted now").
 */
class AdminDashboardSummary
{
    private int $companyId = 0;

    /** @return array<string, mixed> */
    public function get(User $admin): array
    {
        // An Admin with no company sees zeros (a Super Admin must assign one), never other companies' data
        $this->companyId = (int) ($admin->company_id ?? 0);

        $usersWithoutAccess = $this->operationalUsersWithoutAccess();
        $departments = Department::where('company_id', $this->companyId);
        $departmentsWithoutHead = (clone $departments)->whereNull('head_user_id')->count();
        $companiesWithoutPayeeTypes = $this->activeCompaniesWithoutPayeeTypes();
        $company = Company::find($this->companyId);
        $people = (new CompanyUserDirectory($this->companyId))->base();

        return [
            'company' => $company ? ['id' => $company->id, 'name' => $company->name, 'is_active' => (bool) $company->is_active] : null,
            'companies' => [
                'total' => $company ? 1 : 0,
                'active' => $company?->is_active ? 1 : 0,
                'inactive' => $company && ! $company->is_active ? 1 : 0,
            ],
            'departments' => [
                'total' => (clone $departments)->count(),
                'without_head' => $departmentsWithoutHead,
                'companies' => (clone $departments)->exists() ? 1 : 0,
            ],
            'users' => [
                'total' => (clone $people)->count(),
                'added_this_month' => (clone $people)->where('created_at', '>=', now()->startOfMonth())->count(),
                'never_signed_in' => (clone $people)->withAccountStatus('pending')->count(),
            ],
            'company_access' => [
                'total' => DB::table('user_company_access')->where('company_id', $this->companyId)->where('granted_status', 'accepted')->count(),
                'users_without_access' => $usersWithoutAccess,
            ],
            'needs_attention' => array_values(array_filter([
                ($joinRequests = DB::table('user_company_access')->where('company_id', $this->companyId)
                    ->where('granted_status', 'pending')->where('kind', 'request')->count()) > 0
                    ? ['type' => 'join_requests', 'count' => $joinRequests] : null,
                $usersWithoutAccess > 0 ? ['type' => 'users_without_access', 'count' => $usersWithoutAccess] : null,
                $departmentsWithoutHead > 0 ? ['type' => 'departments_without_head', 'count' => $departmentsWithoutHead] : null,
                ...$companiesWithoutPayeeTypes->map(fn (Company $company) => [
                    'type' => 'company_without_payee_types',
                    'company' => ['id' => $company->id, 'name' => $company->name],
                ]),
                $company && ! DB::table('voucher_types')->where('company_id', $company->id)->exists()
                    ? ['type' => 'company_without_voucher_types'] : null,
                $company && ! DB::table('voucher_categories')->where('is_active', true)
                    ->where(fn ($q) => $q->where('company_id', $company->id)->orWhereNull('company_id'))->exists()
                    ? ['type' => 'company_without_categories'] : null,
            ])),
            'recent_activity' => $this->recentActivity(),
        ];
    }

    /** Active clerks / officers / supervisors of THIS company who can't open it yet (= Company access page). */
    private function operationalUsersWithoutAccess(): int
    {
        return AccessCandidates::query($this->companyId)->count();
    }

    /** Active companies with no payee types: their clerks can't fill in "payee type" on a voucher. */
    private function activeCompaniesWithoutPayeeTypes()
    {
        return Company::whereKey($this->companyId)->where('is_active', true)
            ->whereNotExists(fn ($q) => $q->select(DB::raw(1))
                ->from('payee_types')
                ->whereColumn('payee_types.company_id', 'companies.id'))
            ->orderBy('name')
            ->limit(5)
            ->get(['id', 'name']);
    }

    /**
     * The 5 newest audit-log entries of this company (never voucher activity).
     *
     * @return array<int, array<string, mixed>>
     */
    private function recentActivity(): array
    {
        return DB::table('audit_logs')
            ->where('audit_logs.company_id', $this->companyId)
            ->whereNotIn('audit_logs.action', AuditCatalog::actionsIn('vouchers'))
            ->whereNotIn('audit_logs.table_name', AuditLogSearch::VOUCHER_TABLES)
            ->leftJoin('users', 'users.id', '=', 'audit_logs.user_id')
            ->leftJoin('companies', 'companies.id', '=', 'audit_logs.company_id')
            ->orderByDesc('audit_logs.created_at')
            ->orderByDesc('audit_logs.id')
            ->limit(5)
            ->get([
                'audit_logs.id', 'audit_logs.action', 'audit_logs.table_name', 'audit_logs.record_id',
                'audit_logs.old_values', 'audit_logs.new_values', 'audit_logs.created_at',
                'users.first_name as actor_first_name', 'users.last_name as actor_last_name',
                'companies.name as company_name',
            ])
            ->map(function ($row) {
                $values = json_decode($row->new_values ?? '', true) ?: json_decode($row->old_values ?? '', true) ?: [];

                return [
                    'id' => $row->id,
                    'action' => $row->action,
                    'entity' => $row->table_name,
                    'record_id' => $row->record_id,
                    // A readable name for the changed record, e.g. "Juan Dela Cruz" or "Petty Cash"
                    'subject' => $values['name']
                        ?? trim(($values['first_name'] ?? '').' '.($values['last_name'] ?? ''))
                        ?: null,
                    'actor' => trim("{$row->actor_first_name} {$row->actor_last_name}") ?: null,
                    'company' => $row->company_name,
                    'created_at' => $row->created_at ? Carbon::parse($row->created_at)->toIso8601String() : null,
                ];
            })
            ->all();
    }
}
