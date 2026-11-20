<?php

namespace App\Domain\Identity\Actions;

use App\Domain\Identity\Support\AccountActions;
use App\Domain\Security\Support\OwnerActivity;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * "Edit details" (Admins tab A9). Decided 2026-11-21: ONE company (a select) + the personal email.
 *
 * In ONE transaction: save, audit row with before → after, tell the other Super Admins.
 * Changing the SIGN-IN email or the COMPANY signs them out everywhere (their next sign-in uses
 * the new address / lands in the new company). For a pending Admin whose sign-in email changed,
 * the old invitation link stops working, so a new one is sent (after the transaction).
 *
 * Returns ['admin' => User, 'changed' => [field names], 'invitation_resent' => ?bool].
 */
class UpdateAdmin
{
    private const FIELDS = ['first_name', 'last_name', 'email', 'company_id', 'personal_email'];

    public function __construct(private SendAccountInvitation $invitation) {}

    /** @param  array{first_name: string, last_name: string, email: string, company_id: int, personal_email: ?string}  $data */
    public function handle(User $target, array $data, User $by, ?string $ip): array
    {
        $result = DB::transaction(function () use ($target, $data, $by, $ip) {
            $target = User::whereKey($target->id)->lockForUpdate()->firstOrFail();
            AccountActions::authorize($by, $target, 'edit');

            $old = $target->only(self::FIELDS);
            $target->fill(array_intersect_key($data, array_flip(self::FIELDS)));
            $changed = array_keys($target->getDirty());

            if ($changed === []) {
                return ['admin' => $target, 'changed' => [], 'old_email' => null];
            }

            $target->save();

            if (array_intersect($changed, ['email', 'company_id'])) {
                OwnerActivity::signOutEverywhere($target);
            }
            if (in_array('email', $changed, true)) {
                DB::table('password_reset_tokens')->where('email', $old['email'])->delete();
            }

            OwnerActivity::audit($by, 'updated', 'users', $target->id,
                array_intersect_key($old, array_flip($changed)), $target->only($changed), $ip, $target->company_id);

            OwnerActivity::tellOtherOwners($by, 'user_changed', 'Admin details changed',
                "{$by->full_name} changed {$target->full_name}'s ".implode(', ', array_map(fn ($f) => str_replace('_', ' ', $f === 'company_id' ? 'company' : $f), $changed)).'.');

            return ['admin' => $target, 'changed' => $changed, 'old_email' => $old['email']];
        });

        $resent = null;
        if (in_array('email', $result['changed'], true) && $result['admin']->access_status === 'pending') {
            $resent = $this->invitation->handle($result['admin'], $by, $ip);
        }

        return ['admin' => $result['admin'], 'changed' => $result['changed'], 'invitation_resent' => $resent];
    }
}
