<?php

namespace App\Domain\Identity\Account;

use App\Domain\Audit\AuditTrail;
use App\Domain\Security\Actions\RaiseSecurityAlert;
use App\Models\SecurityAlert;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * "Change password" while signed in (the Form Request already checked the current password
 * and the new password's rules).
 *
 * What happens:
 *   1. the new password is saved (hashed, never stored as typed)
 *   2. every OTHER browser is signed out: a stolen session stops working the moment the owner
 *      changes their password. This browser stays signed in.
 *   3. an audit row, and for Admins / Super Admins a Low security alert to the other Super Admins
 *      (the same rule as a password chosen through a reset link)
 */
class ChangeOwnPassword
{
    public function __construct(private OwnSessions $sessions, private RaiseSecurityAlert $raise) {}

    /** @return int how many other browsers were signed out */
    public function handle(User $user, string $newPassword, string $currentSessionId, ?string $ip, ?string $device): int
    {
        return DB::transaction(function () use ($user, $newPassword, $currentSessionId, $ip, $device) {
            $user->forceFill(['password' => $newPassword])->save();

            $signedOut = $this->sessions->signOutOthers($user, $currentSessionId, $ip, audit: false);

            AuditTrail::record([
                'user_id' => $user->id,
                'company_id' => $user->company_id,
                'action' => 'password_changed',
                'table_name' => 'users',
                'record_id' => $user->id,
                'new_values' => ['other_devices_signed_out' => $signedOut],
                'ip_address' => $ip,
            ]);

            if (in_array($user->role, ['admin', 'super_admin'], true)) {
                $this->raise->handle([
                    'type' => SecurityAlert::TYPE_PASSWORD_CHANGED,
                    'severity' => 'low',
                    'user_id' => $user->id,
                    'subject_email' => strtolower($user->email),
                    'ip_address' => $ip,
                    'device' => $device,
                    'details' => ['via' => 'account_settings'],
                ], 'Password was changed', "{$user->full_name} changed their password in Account settings.", [$user->id]);
            }

            return $signedOut;
        });
    }
}
