<?php

namespace App\Domain\Identity\Actions;

use App\Domain\Security\Support\OwnerActivity;
use App\Exceptions\ApiException;
use App\Mail\PasswordResetMail;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Throwable;

/**
 * "Reset password" (Security alert detail, Framer SCoT_cu7B).
 *
 *   1. email a one-time "choose a new password" link (60 minutes) to the Admin's PERSONAL email
 *   2. only if the email went out: scramble the old password and sign them out everywhere,
 *      so whoever was guessing (or already knew it) is locked out right away
 *
 * The Super Admin never sees or types the new password.
 * Order matters: if the email fails, nothing has changed and the Admin can still sign in.
 */
class SendPasswordReset
{
    /** Laravel's standard password broker: links expire after 60 minutes (config/auth.php). */
    public const BROKER = 'users';

    public function handle(User $admin, User $by, ?int $alertId, ?string $ip): string
    {
        if ($admin->access_status !== 'accepted') {
            throw new ApiException("{$admin->first_name} hasn't set a password yet. Resend their invitation instead.", 'NOT_ACTIVATED', 409);
        }
        if (! $admin->personal_email) {
            throw new ApiException('This Admin has no personal email to send the link to.', 'NO_PERSONAL_EMAIL', 409);
        }

        $token = Password::broker(self::BROKER)->createToken($admin);
        $link = config('app.frontend_url').'/set-password?'.http_build_query(['token' => $token, 'email' => $admin->email]);
        $minutes = (int) config('auth.passwords.'.self::BROKER.'.expire');

        try {
            Mail::to($admin->personal_email)->send(new PasswordResetMail($admin, $link, $minutes));
        } catch (Throwable $e) {
            Log::error('Password reset email failed', ['user_id' => $admin->id, 'error' => $e->getMessage()]);
            Password::broker(self::BROKER)->deleteToken($admin);
            throw new ApiException('The email could not be sent, so the password was not reset. Please try again in a moment.', 'EMAIL_NOT_SENT', 503);
        }

        DB::transaction(function () use ($admin, $by, $alertId, $ip) {
            // Nobody knows this random password, so the old one stops working right now
            $admin->forceFill(['password' => Str::password(48)])->save();
            OwnerActivity::signOutEverywhere($admin);

            OwnerActivity::audit($by, 'password_reset_sent', 'users', $admin->id, null,
                ['sent_to' => $admin->personal_email, 'security_alert_id' => $alertId], $ip, $admin->company_id);

            if ($alertId) {
                OwnerActivity::closeAlertIfOpen($alertId, $by, $ip);
            }

            OwnerActivity::tellOtherOwners($by, 'user_changed', 'Admin password reset',
                "{$by->full_name} reset {$admin->full_name}'s password. A new link was emailed to them.");
        });

        return $admin->personal_email;
    }
}
