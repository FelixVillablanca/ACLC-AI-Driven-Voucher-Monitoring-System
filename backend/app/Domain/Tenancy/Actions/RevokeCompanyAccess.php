<?php

namespace App\Domain\Tenancy\Actions;

use App\Domain\Audit\AuditTrail;
use App\Domain\Tenancy\Queries\AccessCandidates;
use App\Domain\Tenancy\Support\AdminCompany;
use App\Exceptions\ApiException;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * "Remove access" on the Company access page: the person can no longer open the Admin's company.
 *
 * The access row is kept and marked `denied` (with who and when), so the history stays and the
 * person shows under "No access", from where they can be granted again. Their account itself is
 * untouched (they keep any other company they have access to).
 * 404 when the person has no access row for this company; 409 ACCESS_NOT_GRANTED when it isn't
 * accepted (e.g. another Admin just removed it). Rows are locked while checking.
 */
class RevokeCompanyAccess
{
    public function handle(int $userId, ?string $reason, User $admin, ?string $ip = null): User
    {
        $company = AdminCompany::activeFor($admin, 'access changes');

        return DB::transaction(function () use ($userId, $reason, $admin, $ip, $company) {
            $row = DB::table('user_company_access')
                ->where('user_id', $userId)->where('company_id', $company->id)->lockForUpdate()->first();
            $user = $row ? User::whereKey($userId)->whereIn('role', AccessCandidates::OPERATIONAL_ROLES)->first() : null;

            if (! $row || ! $user) {
                throw new ApiException('We could not find what you are looking for.', 'NOT_FOUND', 404);
            }
            if ($row->granted_status !== 'accepted') {
                throw new ApiException("{$user->full_name} doesn't have access to {$company->name} right now.", 'ACCESS_NOT_GRANTED', 409);
            }

            DB::table('user_company_access')->where('id', $row->id)->update([
                'granted_status' => 'denied', 'granted_by' => $admin->id, 'granted_at' => now(), 'updated_at' => now(),
            ]);

            AuditTrail::record([
                'user_id' => $admin->id,
                'company_id' => $company->id,
                'action' => 'access_revoked',
                'table_name' => 'user_company_access',
                'record_id' => $row->id,
                'old_values' => ['granted_status' => 'accepted'],
                'new_values' => array_filter([
                    'user_id' => $user->id, 'first_name' => $user->first_name, 'last_name' => $user->last_name,
                    'granted_status' => 'denied', 'reason' => $reason,
                ], fn ($v) => $v !== null),
                'ip_address' => $ip,
            ]);

            User::where('role', 'admin')->where('company_id', $company->id)->whereKeyNot($admin->id)->pluck('id')
                ->each(fn (int $id) => Notification::create([
                    'recipient_id' => $id,
                    'type' => 'access_changed',
                    'title' => 'Company access removed',
                    'message' => "{$admin->full_name} removed {$user->full_name}'s access to {$company->name}.".($reason ? " Reason: \"{$reason}\"" : ''),
                ]));

            return $user;
        });
    }
}
