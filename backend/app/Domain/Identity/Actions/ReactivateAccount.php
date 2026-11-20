<?php

namespace App\Domain\Identity\Actions;

use App\Domain\Identity\Support\AccountActions;
use App\Domain\Security\Support\OwnerActivity;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/** "Reactivate account": undoes DeactivateAccount (they can sign in again with their password). */
class ReactivateAccount
{
    public function handle(User $target, User $by, ?string $ip): User
    {
        return DB::transaction(function () use ($target, $by, $ip) {
            if ($target->role === 'super_admin') {
                User::where('role', 'super_admin')->where('is_active', true)->lockForUpdate()->get(['id']);
                AccountActions::forgetSeats();
            }
            $target = User::whereKey($target->id)->lockForUpdate()->firstOrFail();
            AccountActions::authorize($by, $target, 'reactivate');

            $target->forceFill(['is_active' => true, 'deactivated_at' => null])->save();
            AccountActions::forgetSeats();

            OwnerActivity::audit($by, 'account_reactivated', 'users', $target->id,
                ['is_active' => false], ['is_active' => true], $ip, $target->company_id);

            OwnerActivity::tellOtherOwners($by, 'user_changed', 'Account reactivated',
                "{$by->full_name} reactivated {$target->full_name}'s account ({$target->email}).");

            return $target;
        });
    }
}
