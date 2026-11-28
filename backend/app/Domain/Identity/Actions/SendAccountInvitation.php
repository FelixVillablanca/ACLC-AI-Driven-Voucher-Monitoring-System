<?php

namespace App\Domain\Identity\Actions;

use App\Domain\Audit\AuditTrail;
use App\Mail\AccountInvitationMail;
use App\Models\User;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Password;
use Throwable;

/**
 * Emails a "set your password" link to the person's PERSONAL email.
 *
 * The link holds a one-time TOKEN (a long random code). Laravel stores only a scrambled copy
 * (in password_reset_tokens), so even someone reading the database can't use it.
 * A new invitation replaces the old one, so only the newest link works.
 *
 * Returns false (instead of crashing) when the email couldn't be sent: the account already
 * exists, and the Super Admin sees "not sent" with a Resend button.
 */
class SendAccountInvitation
{
    public const BROKER = 'invites';

    public function handle(User $user, ?User $sentBy = null, ?string $ip = null): bool
    {
        if (! $user->personal_email) {
            return false;
        }

        $token = Password::broker(self::BROKER)->createToken($user);
        $link = config('app.frontend_url').'/set-password?'.http_build_query(['token' => $token, 'email' => $user->email]);
        $hours = intdiv((int) config('auth.passwords.'.self::BROKER.'.expire'), 60);

        try {
            Mail::to($user->personal_email)->send(new AccountInvitationMail(
                $user, $link, $user->company?->name, $hours,
            ));
        } catch (Throwable $e) {
            Log::error('Account invitation email failed', ['user_id' => $user->id, 'error' => $e->getMessage()]);

            return false;
        }

        AuditTrail::record([
            'user_id' => $sentBy?->id,
            'company_id' => $user->company_id,
            'action' => 'invitation_sent',
            'table_name' => 'users',
            'record_id' => $user->id,
            'old_values' => null,
            'new_values' => json_encode(['sent_to' => $user->personal_email, 'expires_in_hours' => $hours]),
            'ip_address' => $ip,
            'user_agent' => null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return true;
    }
}
