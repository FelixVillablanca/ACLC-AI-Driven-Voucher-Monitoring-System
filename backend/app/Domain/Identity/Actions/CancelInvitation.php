<?php

namespace App\Domain\Identity\Actions;

use App\Domain\Identity\Support\AccountActions;
use App\Domain\Security\Support\OwnerActivity;
use App\Exceptions\ApiException;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;

/**
 * "Cancel invite" (Admins tab A5 Pending view). Decided 2026-11-21: the pending account is
 * DELETED, so the work email is free again (e.g. after a typo). Only for an Admin who never
 * set a password and never signed in. What stays: an audit row with a copy of the account,
 * and a notice to the other Super Admins.
 */
class CancelInvitation
{
    public function handle(User $target, User $by, ?string $ip): void
    {
        DB::transaction(function () use ($target, $by, $ip) {
            $target = User::whereKey($target->id)->lockForUpdate()->firstOrFail();
            AccountActions::authorize($by, $target, 'cancel_invitation');

            $snapshot = [
                'employee_id' => $target->employee_id,
                'name' => $target->full_name,
                'email' => $target->email,
                'personal_email' => $target->personal_email,
                'company_id' => $target->company_id,
            ];

            DB::table('password_reset_tokens')->where('email', $target->email)->delete();
            DB::table('notifications')->where('recipient_id', $target->id)->delete();
            DB::table('user_company_access')->where('user_id', $target->id)->delete();

            try {
                $target->delete();
            } catch (QueryException) {
                // Something else points at this account (e.g. it already did something): keep it
                throw new ApiException('This account is already in use and can’t be deleted. Deactivate it instead.', 'CANT_DELETE', 409);
            }

            OwnerActivity::audit($by, 'invitation_cancelled', 'users', $target->id, $snapshot, null, $ip, $snapshot['company_id']);
            OwnerActivity::tellOtherOwners($by, 'user_changed', 'Invitation cancelled',
                "{$by->full_name} cancelled the invitation for {$snapshot['name']} ({$snapshot['email']}).");
        });
    }
}
