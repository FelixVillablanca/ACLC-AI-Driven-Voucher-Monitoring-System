<?php

namespace App\Domain\Identity\Actions;

use App\Domain\Identity\Support\AccountActions;
use App\Domain\Security\Support\OwnerActivity;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * "Deactivate account" (Admins tab ⋯ menu / bulk bar, Security alert detail).
 * Decided 2026-11-21: ONE action (it used to be called "Lock"). The account can't sign in,
 * is signed out everywhere, and shows as "Inactive" until a Super Admin reactivates it.
 * The spec (§4) calls it SENSITIVE, so the request carries the Super Admin's password.
 *
 * Works for Admins and Super Admins, but never on yourself and never on the LAST active
 * Super Admin (the Super Admin rows are LOCKED while checking, so two people can't each
 * deactivate "the other one" at the same moment and leave nobody).
 */
class DeactivateAccount
{
    public function handle(User $target, User $by, ?int $alertId, ?string $ip): User
    {
        return DB::transaction(function () use ($target, $by, $alertId, $ip) {
            if ($target->role === 'super_admin') {
                User::where('role', 'super_admin')->where('is_active', true)->lockForUpdate()->get(['id']);
                AccountActions::forgetSeats();
            }
            $target = User::whereKey($target->id)->lockForUpdate()->firstOrFail();
            AccountActions::authorize($by, $target, 'deactivate');

            $target->forceFill(['is_active' => false, 'deactivated_at' => now()])->save();
            OwnerActivity::signOutEverywhere($target);
            AccountActions::forgetSeats();

            OwnerActivity::audit($by, 'account_deactivated', 'users', $target->id,
                ['is_active' => true], ['is_active' => false, 'security_alert_id' => $alertId], $ip, $target->company_id);

            if ($alertId) {
                OwnerActivity::closeAlertIfOpen($alertId, $by, $ip);
            }

            OwnerActivity::tellOtherOwners($by, 'user_changed', 'Account deactivated',
                "{$by->full_name} deactivated {$target->full_name}'s account ({$target->email}).");

            return $target;
        });
    }
}
