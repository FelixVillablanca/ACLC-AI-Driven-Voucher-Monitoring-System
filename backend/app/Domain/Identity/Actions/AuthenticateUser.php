<?php

namespace App\Domain\Identity\Actions;

use App\Domain\Identity\Support\AccountStanding;
use App\Models\User;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;

/**
 * ACTION = one business task in one class ("log a user in").
 * The controller stays thin: it only passes data in and sends the answer back.
 * The rules live here, so they can be tested and reused.
 *
 * Order: 1) check the password WITHOUT signing in, 2) check the account is allowed in,
 * 3) only then sign in. A blocked person never gets a session, not even for a moment.
 */
class AuthenticateUser
{
    public function handle(string $email, string $password, bool $remember = false): User
    {
        $guard = Auth::guard('web');

        // Wrong email OR wrong password -> the SAME message, on purpose.
        // Saying "email not found" would tell attackers which emails exist.
        if (! $guard->validate(['email' => $email, 'password' => $password])) {
            throw ValidationException::withMessages([
                'email' => 'These credentials do not match our records.',
            ]);
        }

        /** @var User $user */
        $user = $guard->getLastAttempted();

        // Correct password, but deactivated / not approved / every company suspended
        if ($problem = AccountStanding::problem($user)) {
            throw $problem;
        }

        // "Keep me signed in" (a 30-day cookie) is never allowed for Super Admins:
        // the platform owner's session must end after the short idle timeout (spec §4.6).
        $guard->login($user, $remember && $user->role !== 'super_admin');

        // forceFill + saveQuietly: update one column without firing model events
        $user->forceFill(['last_login_at' => now()])->saveQuietly();

        return $user;
    }
}
