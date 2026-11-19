<?php

namespace App\Domain\Reporting\Queries;

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
 */
class AdminDashboardSummary
{
    private const OPERATIONAL_ROLES = ['accounting_clerk', 'accounting_officer', 'supervisor_manager'];

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
        $people = $this->peopleInCompany();

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
            ],
            'company_access' => [
                'total' => DB::table('user_company_access')->where('company_id', $this->companyId)->where('granted_status', 'accepted')->count(),
                'users_without_access' => $usersWithoutAccess,
            ],
            'needs_attention' => array_values(array_filter([
                $usersWithoutAccess > 0 ? ['type' => 'users_without_access', 'count' => $usersWithoutAccess] : null,
                $departmentsWithoutHead > 0 ? ['type' => 'departments_without_head', 'count' => $departmentsWithoutHead] : null,
                ...$companiesWithoutPayeeTypes->map(fn (Company $company) => [
                    'type' => 'company_without_payee_types',
                    'company' => ['id' => $company->id, 'name' => $company->name],
                ]),
            ])),
            'recent_activity' => $this->recentActivity(),
        ];
    }

    /** Everyone whose home company is this one, or who was given access to it (Super Admins excluded). */
    private function peopleInCompany()
    {
        return User::where('role', '!=', 'super_admin')
            ->where(fn ($q) => $q->where('company_id', $this->companyId)
                ->orWhereHas('accessibleCompanies', fn ($c) => $c
                    ->where('companies.id', $this->companyId)
                    ->where('user_company_access.granted_status', 'accepted')));
    }

    /** Clerks/officers/supervisors of THIS company who can't open ANY company yet (so they can't work). */
    private function operationalUsersWithoutAccess(): int
    {
        return User::whereIn('role', self::OPERATIONAL_ROLES)
            ->where('company_id', $this->companyId)
            ->whereDoesntHave('accessibleCompanies', fn ($q) => $q->where('user_company_access.granted_status', 'accepted'))
            ->count();
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
     * The 5 newest audit-log entries. Rows are written by the audit observer
     * (still to be built), so this list is empty until then.
     *
     * @return array<int, array<string, mixed>>
     */
    private function recentActivity(): array
    {
        return DB::table('audit_logs')
            ->where('audit_logs.company_id', $this->companyId)
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
