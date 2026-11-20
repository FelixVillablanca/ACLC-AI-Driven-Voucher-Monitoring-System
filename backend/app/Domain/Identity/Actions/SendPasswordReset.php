<?php

namespace App\Domain\Identity\Actions;

use App\Domain\Identity\Support\AccountActions;
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
 * "Send password reset" (Admins tab A10, bulk bar, Security alert detail).
 *
 *   1. email a one-time "choose a new password" link (60 minutes) to the PERSONAL email
 *      (the @Administrator.com sign-in address isn't a real mailbox)
 *   2. only if the email went out, and only when $signOut is true (the default, "Also sign them
 *      out everywhere now"): scramble the old password and end every session, so whoever might
 *      know it is locked out right away. Unticked = they just forgot it: nothing else changes.
 *
 * The Super Admin never sees or chooses the new password.
 * Order matters: if the email fails, nothing has changed.
 */
class SendPasswordReset
{
    /** Laravel's standard password broker: links expire after 60 minutes (config/auth.php). */
    public const BROKER = 'users';

    public function handle(User $target, User $by, ?int $alertId, ?string $ip, bool $signOut = true): string
    {
        AccountActions::authorize($by, $target, 'reset_password');

        $token = Password::broker(self::BROKER)->createToken($target);
        $link = config('app.frontend_url').'/set-password?'.http_build_query(['token' => $token, 'email' => $target->email]);
        $minutes = (int) config('auth.passwords.'.self::BROKER.'.expire');

        try {
            Mail::to($target->personal_email)->send(new PasswordResetMail($target, $link, $minutes, $signOut));
        } catch (Throwable $e) {
            Log::error('Password reset email failed', ['user_id' => $target->id, 'error' => $e->getMessage()]);
            Password::broker(self::BROKER)->deleteToken($target);
            throw new ApiException('The email could not be sent, so the password was not reset. Please try again in a moment.', 'EMAIL_NOT_SENT', 503);
        }

        DB::transaction(function () use ($target, $by, $alertId, $ip, $signOut) {
            if ($signOut) {
                // Nobody knows this random password, so the old one stops working right now
                $target->forceFill(['password' => Str::password(48)])->save();
                OwnerActivity::signOutEverywhere($target);
            }

            OwnerActivity::audit($by, 'password_reset_sent', 'users', $target->id, null,
                ['sent_to' => $target->personal_email, 'signed_out' => $signOut, 'security_alert_id' => $alertId], $ip, $target->company_id);

            if ($alertId) {
                OwnerActivity::closeAlertIfOpen($alertId, $by, $ip);
            }

            OwnerActivity::tellOtherOwners($by, 'user_changed', 'Password reset sent',
                "{$by->full_name} sent {$target->full_name} a password reset link".($signOut ? ' and signed them out everywhere.' : '.'));
        });

        return $target->personal_email;
    }
}
