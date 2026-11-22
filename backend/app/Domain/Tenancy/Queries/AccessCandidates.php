<?php

namespace App\Domain\Tenancy\Queries;

use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

/**
 * Who can be given access to the Admin's company (Quick actions → "Grant company access").
 *
 * = clerks / officers / supervisors whose HOME company is the Admin's company, who are active,
 *   and who don't have ACCEPTED access to it yet (no row, or a pending / denied one).
 * These are the people the dashboard counts as "users without access": they can't work yet.
 * Users of other companies are never listed (an Admin only manages their own company).
 */
class AccessCandidates
{
    public const OPERATIONAL_ROLES = ['accounting_clerk', 'accounting_officer', 'supervisor_manager'];

    public static function query(int $companyId): Builder
    {
        return User::query()
            ->whereIn('role', self::OPERATIONAL_ROLES)
            ->where('company_id', $companyId)
            ->where('is_active', true)
            ->whereDoesntHave('accessibleCompanies', fn (Builder $q) => $q
                ->where('companies.id', $companyId)
                ->where('user_company_access.granted_status', 'accepted'));
    }

    /** The list for the dialog, A–Z, with the current access row's status (none / pending / denied). */
    public function list(int $companyId, ?string $search = null, int $limit = 100): array
    {
        $query = self::query($companyId)
            ->with(['department:id,name'])
            ->addSelect(['access_status_for_company' => DB::table('user_company_access')
                ->select('granted_status')
                ->whereColumn('user_company_access.user_id', 'users.id')
                ->where('user_company_access.company_id', $companyId)
                ->limit(1)]);

        if ($search) {
            $like = '%'.addcslashes($search, '\\%_').'%';
            $query->where(fn (Builder $q) => $q
                ->where('first_name', 'like', $like)
                ->orWhere('last_name', 'like', $like)
                ->orWhereRaw("CONCAT(first_name, ' ', last_name) LIKE ?", [$like])
                ->orWhere('email', 'like', $like)
                ->orWhere('employee_id', 'like', $like));
        }

        $total = (clone $query)->count();
        $users = $query->orderBy('first_name')->orderBy('last_name')->limit($limit)->get();

        return ['users' => $users, 'total' => $total];
    }
}
