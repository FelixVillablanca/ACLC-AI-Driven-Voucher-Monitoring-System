<?php

namespace App\Domain\Identity\Actions;

use App\Domain\Security\Support\OwnerActivity;
use App\Exceptions\ApiException;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * "Lock account" (Security alert detail, Framer SCoT_cu7B).
 * The Admin is signed out everywhere and can't sign in until a Super Admin unlocks them.
 * It uses the same switch as "deactivate" (users.is_active = false), so every existing
 * check (sign-in, every request) already blocks them.
 *
 * In ONE transaction: lock the account, sign them out, audit row, close the alert it came from,
 * tell the other Super Admins.
 */
class LockAdminAccount
{
    public function handle(User $admin, User $by, ?int $alertId, ?string $ip): User
    {
        return DB::transaction(function () use ($admin, $by, $alertId, $ip) {
            $admin = User::whereKey($admin->id)->lockForUpdate()->firstOrFail();

            if (! $admin->is_active) {
                throw new ApiException("{$admin->full_name}'s account is already locked.", 'ALREADY_LOCKED', 409);
            }

            $admin->forceFill(['is_active' => false, 'deactivated_at' => now()])->save();
            OwnerActivity::signOutEverywhere($admin);

            OwnerActivity::audit($by, 'account_locked', 'users', $admin->id,
                ['is_active' => true], ['is_active' => false, 'security_alert_id' => $alertId], $ip, $admin->company_id);

            if ($alertId) {
                OwnerActivity::closeAlertIfOpen($alertId, $by, $ip);
            }

            OwnerActivity::tellOtherOwners($by, 'user_changed', 'Admin account locked',
                "{$by->full_name} locked {$admin->full_name}'s account ({$admin->email}).");

            return $admin;
        });
    }
}
