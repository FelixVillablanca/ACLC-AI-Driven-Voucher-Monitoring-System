<?php

namespace App\Domain\Identity\Actions;

use App\Domain\Security\Support\OwnerActivity;
use App\Exceptions\ApiException;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/** "Unlock account": undoes LockAdminAccount (the Admin can sign in again with their password). */
class UnlockAdminAccount
{
    public function handle(User $admin, User $by, ?string $ip): User
    {
        return DB::transaction(function () use ($admin, $by, $ip) {
            $admin = User::whereKey($admin->id)->lockForUpdate()->firstOrFail();

            if ($admin->is_active) {
                throw new ApiException("{$admin->full_name}'s account isn't locked.", 'NOT_LOCKED', 409);
            }

            $admin->forceFill(['is_active' => true, 'deactivated_at' => null])->save();

            OwnerActivity::audit($by, 'account_unlocked', 'users', $admin->id,
                ['is_active' => false], ['is_active' => true], $ip, $admin->company_id);

            OwnerActivity::tellOtherOwners($by, 'user_changed', 'Admin account unlocked',
                "{$by->full_name} unlocked {$admin->full_name}'s account ({$admin->email}).");

            return $admin;
        });
    }
}
