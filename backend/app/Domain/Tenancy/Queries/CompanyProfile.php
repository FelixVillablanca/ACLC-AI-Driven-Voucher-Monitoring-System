<?php

namespace App\Domain\Tenancy\Queries;

use App\Models\Company;
use App\Models\Department;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;

/**
 * QUERY CLASS for the company side panel (Framer C8 a17W5hpkA): its 4 tabs
 * Overview / Departments / Users / History. Counts, names and dates only, never money.
 */
class CompanyProfile
{
    /** The Overview tab's extra facts (the card data comes from CompanyDirectory::withCardData). */
    public function overview(Company $company): array
    {
        $users = CompanyDirectory::usersOf($company->id);

        return [
            'contact_email' => $company->contact_email,
            'contact_phone' => $company->contact_phone,
            // the map pin chosen in "+ Add company" (null when none was placed); numbers stay strings (DECIMAL)
            'location' => $company->latitude === null ? null : [
                'latitude' => $company->latitude,
                'longitude' => $company->longitude,
                'place_id' => $company->place_id,
            ],
            'two_factor_on' => (clone $users)->whereNotNull('two_factor_confirmed_at')->whereNotNull('two_factor_secret')->count(),
            'largest_departments' => $this->departments($company)->take(3)
                ->map(fn (Department $d) => ['id' => $d->id, 'name' => $d->name, 'users_count' => (int) $d->users_count])
                ->values()->all(),
        ];
    }

    /** Every department, biggest first (people count = users whose department it is). */
    public function departments(Company $company): Collection
    {
        return $company->departments()
            ->withCount(['users' => fn ($q) => $q->where('role', '!=', 'super_admin')])
            ->with('head:id,first_name,last_name')
            ->orderByDesc('users_count')->orderBy('name')->orderBy('id')
            ->get();
    }

    /** People of the company (home company or accepted access), A–Z, one page at a time. */
    public function users(Company $company, int $perPage = 20): LengthAwarePaginator
    {
        return CompanyDirectory::usersOf($company->id)
            ->with('department:id,name')
            ->orderBy('first_name')->orderBy('last_name')->orderBy('id')
            ->paginate($perPage);
    }

    /**
     * What happened TO the company itself (suspended, reactivated, exported, …), newest first.
     * The full audit trail of everything people did inside it is the Audit logs tab.
     */
    public function history(Company $company, int $perPage = 20): LengthAwarePaginator
    {
        return DB::table('audit_logs')
            ->leftJoin('users', 'users.id', '=', 'audit_logs.user_id')
            ->where('audit_logs.table_name', 'companies')
            ->where('audit_logs.record_id', $company->id)
            ->orderByDesc('audit_logs.created_at')->orderByDesc('audit_logs.id')
            ->select([
                'audit_logs.id', 'audit_logs.action', 'audit_logs.old_values', 'audit_logs.new_values', 'audit_logs.created_at',
                'audit_logs.user_id', DB::raw("TRIM(CONCAT(COALESCE(users.first_name, ''), ' ', COALESCE(users.last_name, ''))) as user_name"),
            ])
            ->paginate($perPage);
    }
}
