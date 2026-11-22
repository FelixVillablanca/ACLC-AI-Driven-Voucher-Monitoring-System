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
 * "Grant company access" (Admin Quick actions): lets the chosen people open the Admin's company.
 *
 * One transaction. Each chosen user must still be a candidate (AccessCandidates); the rows are
 * LOCKED first, so two Admins clicking at the same time can't both grant (the second gets 409).
 * An existing pending / denied row becomes accepted; otherwise a new row is added.
 * One audit row per person (Recent activity: "Granted Apex access to Maria Lopez").
 */
class GrantCompanyAccess
{
    /**
     * @param  list<int>  $userIds
     * @return list<User> the people who were granted access
     */
    public function handle(array $userIds, User $admin, ?string $ip = null): array
    {
        $company = AdminCompany::activeFor($admin, 'company access');
        $userIds = array_values(array_unique(array_map('intval', $userIds)));

        return DB::transaction(function () use ($userIds, $admin, $ip, $company) {
            // lock the people first, then re-check they still need access (someone may have just granted it)
            User::whereKey($userIds)->lockForUpdate()->get();
            $users = AccessCandidates::query($company->id)->whereKey($userIds)->get();

            if ($users->count() !== count($userIds)) {
                throw new ApiException(
                    'Some of these people already have access, or are no longer in your company. Refresh the list and try again.',
                    'ACCESS_LIST_CHANGED',
                    409,
                );
            }

            $now = now();
            foreach ($users as $user) {
                $existing = DB::table('user_company_access')
                    ->where('user_id', $user->id)->where('company_id', $company->id)->lockForUpdate()->first();

                if ($existing) {
                    // granting a person's own pending request answers it too
                    DB::table('user_company_access')->where('id', $existing->id)->update([
                        'granted_status' => 'accepted', 'granted_by' => $admin->id, 'granted_at' => $now, 'updated_at' => $now,
                        'responded_at' => $now, 'responded_by' => $admin->id,
                    ]);
                    $rowId = $existing->id;
                } else {
                    $rowId = DB::table('user_company_access')->insertGetId([
                        'user_id' => $user->id, 'company_id' => $company->id, 'granted_status' => 'accepted',
                        'granted_by' => $admin->id, 'granted_at' => $now, 'created_at' => $now, 'updated_at' => $now,
                    ]);
                }

                AuditTrail::record([
                    'user_id' => $admin->id,
                    'company_id' => $company->id,
                    'action' => 'access_granted',
                    'table_name' => 'user_company_access',
                    'record_id' => $rowId,
                    'old_values' => $existing ? ['granted_status' => $existing->granted_status] : null,
                    'new_values' => [
                        'user_id' => $user->id,
                        'first_name' => $user->first_name,
                        'last_name' => $user->last_name,
                        'granted_status' => 'accepted',
                    ],
                    'ip_address' => $ip,
                ]);
            }

            $names = $users->take(3)->map->full_name->implode(', ').($users->count() > 3 ? ' and '.($users->count() - 3).' more' : '');
            User::where('role', 'admin')->where('company_id', $company->id)->whereKeyNot($admin->id)->pluck('id')
                ->each(fn (int $id) => Notification::create([
                    'recipient_id' => $id,
                    'type' => 'access_changed',
                    'title' => 'Company access granted',
                    'message' => "{$admin->full_name} gave {$names} access to {$company->name}.",
                ]));

            return $users->all();
        });
    }
}
