<?php

namespace App\Domain\Identity\Support;

use App\Models\User;
use Illuminate\Contracts\Session\Session;

/**
 * The "half signed in" moment between the password and the 6-digit code.
 *
 * After a correct password we do NOT sign the person in yet. We only remember, in their
 * session, WHO is waiting and for which step:
 *   challenge = two-step is on: type the code from the app
 *   setup     = a Super Admin required two-step: scan the QR code first
 * It expires after 10 minutes; then they start again from the password.
 */
class PendingTwoFactorLogin
{
    private const KEY = 'two_factor.pending_login';

    private const MINUTES = 10;

    public static function start(Session $session, User $user, bool $remember, string $stage): void
    {
        $session->put(self::KEY, [
            'user_id' => $user->id,
            'remember' => $remember,
            'stage' => $stage,
            'expires_at' => now()->addMinutes(self::MINUTES)->timestamp,
            'setup_secret' => null, // the not-yet-confirmed key while they set up
        ]);
    }

    /** @return array{user_id: int, remember: bool, stage: string, expires_at: int, setup_secret: ?string}|null */
    public static function get(Session $session): ?array
    {
        $pending = $session->get(self::KEY);
        if (! $pending || $pending['expires_at'] < now()->timestamp) {
            $session->forget(self::KEY);

            return null;
        }

        return $pending;
    }

    public static function user(Session $session): ?User
    {
        $pending = self::get($session);

        return $pending ? User::find($pending['user_id']) : null;
    }

    public static function rememberSetupSecret(Session $session, string $secret): void
    {
        $pending = self::get($session);
        if ($pending) {
            $pending['setup_secret'] = $secret;
            $session->put(self::KEY, $pending);
        }
    }

    public static function clear(Session $session): void
    {
        $session->forget(self::KEY);
    }
}
