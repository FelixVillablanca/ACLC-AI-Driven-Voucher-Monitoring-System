<?php

namespace App\Domain\Identity\Actions;

use App\Exceptions\ApiException;
use App\Models\User;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;

/**
 * ACTION = one business task in one class ("log a user in").
 * The controller stays thin: it only passes data in and sends the answer back.
 * The rules live here, so they can be tested and reused.
 */
class AuthenticateUser
{
    public function handle(string $email, string $password, bool $remember = false): User
    {
        $guard = Auth::guard('web');

        // Wrong email OR wrong password -> the SAME message, on purpose.
        // Saying "email not found" would tell attackers which emails exist.
        if (! $guard->attempt(['email' => $email, 'password' => $password], $remember)) {
            throw ValidationException::withMessages([
                'email' => 'These credentials do not match our records.',
            ]);
        }

        /** @var User $user */
        $user = $guard->user();

        // Correct password, but the admin hasn't activated / approved this account
        if (! $user->is_active || $user->access_status !== 'accepted') {
            $guard->logout();

            throw new ApiException(
                'Your account is not active yet. Please contact your system administrator.',
                'ACCOUNT_INACTIVE',
                403,
            );
        }

        // forceFill + saveQuietly: update one column without firing model events
        $user->forceFill(['last_login_at' => now()])->saveQuietly();

        return $user;
    }
}
