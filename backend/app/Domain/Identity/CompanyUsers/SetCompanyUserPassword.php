<?php

namespace App\Domain\Identity\CompanyUsers;

use App\Domain\Audit\AuditTrail;
use App\Domain\Security\Support\OwnerActivity;
use App\Domain\Tenancy\Support\AdminCompany;
use App\Exceptions\ApiException;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * "Set a new password" for a clerk / officer / supervisor (Users page), the same way Create user
 * works: the password is generated in the Admin's form, the Admin gives it to the person, and the
 * person is signed out everywhere (their old password stops working right away).
 * The password itself is never written to the audit log.
 */
class SetCompanyUserPassword
{
    public function handle(User $target, string $password, User $admin, ?string $ip = null): User
    {
        AdminCompany::activeFor($admin, 'password changes');

        return DB::transaction(function () use ($target, $password, $admin, $ip) {
            /** @var User $target */
            $target = User::whereKey($target->id)->lockForUpdate()->firstOrFail();

            if (! $target->is_active) {
                throw new ApiException("{$target->full_name} is deactivated. Reactivate the account first.", 'USER_INACTIVE', 409);
            }

            $target->forceFill(['password' => $password])->save(); // hashed by the User model
            OwnerActivity::signOutEverywhere($target);

            AuditTrail::record([
                'user_id' => $admin->id,
                'company_id' => $target->company_id,
                'action' => 'password_set_by_admin',
                'table_name' => 'users',
                'record_id' => $target->id,
                'new_values' => ['first_name' => $target->first_name, 'last_name' => $target->last_name, 'signed_out' => true],
                'ip_address' => $ip,
            ]);

            return $target;
        });
    }
}
