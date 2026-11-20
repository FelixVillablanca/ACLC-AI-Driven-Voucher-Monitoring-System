<?php

namespace App\Domain\Identity\Actions;

use App\Domain\Identity\Support\AccountStanding;
use App\Domain\Security\Actions\WatchSignIns;
use App\Models\User;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;

/**
 * ACTION = one business task in one class ("log a user in").
 * The controller stays thin: it only passes data in and sends the answer back.
 * The rules live here, so they can be tested and reused.
 *
 * Order: 1) check the password WITHOUT signing in, 2) check the account is allowed in,
 * 3) two-step sign-in, if it's on or required, 4) only then sign in.
 * A blocked person never gets a session, not even for a moment.
 */
class AuthenticateUser
{
    public function __construct(private WatchSignIns $watch) {}

    /**
     * Steps 1–3. Returns the user and what still has to happen:
     *   ['user' => User, 'two_factor' => null]         → call finish() now
     *   ['user' => User, 'two_factor' => 'challenge']  → ask for the 6-digit code first
     *   ['user' => User, 'two_factor' => 'setup']      → they must set up two-step first
     *
     * @return array{user: User, two_factor: ?string}
     */
    public function check(string $email, string $password, ?string $ip = null, ?string $userAgent = null): array
    {
        $guard = Auth::guard('web');

        // Wrong email OR wrong password -> the SAME message, on purpose.
        // Saying "email not found" would tell attackers which emails exist.
        // (Only the audit log and the Security alerts panel know which one it was.)
        if (! $guard->validate(['email' => $email, 'password' => $password])) {
            /** @var User|null $known */
            $known = $guard->getLastAttempted();
            $this->watch->failed($email, $known, $known ? 'wrong_password' : 'unknown_email', $ip, $userAgent);

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

        $twoFactor = match (true) {
            $user->hasTwoFactor() => 'challenge',
            $user->mustSetUpTwoFactor() => 'setup',
            default => null,
        };

        return ['user' => $user, 'two_factor' => $twoFactor];
    }

    /** Step 4: really sign in (after the password, and the code if two-step is on). */
    public function finish(User $user, bool $remember = false, ?string $ip = null, ?string $userAgent = null): User
    {
        // "Keep me signed in" (a 30-day cookie) is never allowed for Super Admins:
        // the platform owner's session must end after the short idle timeout (spec §4.6).
        Auth::guard('web')->login($user, $remember && $user->role !== 'super_admin');

        // forceFill + saveQuietly: update one column without firing model events
        $user->forceFill(['last_login_at' => now()])->saveQuietly();

        // Audit row + "new device?" check (Security alerts panel)
        $this->watch->succeeded($user, $ip, $userAgent);

        return $user;
    }
}
