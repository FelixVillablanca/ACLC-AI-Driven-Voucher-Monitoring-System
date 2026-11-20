<?php

namespace App\Http\Middleware;

use App\Domain\Identity\Support\AccountStanding;
use App\Exceptions\ApiException;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

/**
 * Runs on EVERY signed-in API request. If the account was deactivated, or every company
 * the person works in was suspended, AFTER they signed in, they are signed out right now
 * (on their next click) instead of keeping a working session for hours.
 *
 * Same rule as sign-in: see App\Domain\Identity\Support\AccountStanding.
 */
class EnsureAccountInGoodStanding
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        // A Super Admin required two-step and the setup window ran out: sign them out, so the
        // next sign-in takes them through the setup screen (the only way back in).
        $problem = $user ? AccountStanding::problem($user) : null;
        if ($user && ! $problem && $user->twoFactorSetupOverdue()) {
            $problem = new ApiException(
                'Two-step sign-in is now required for your account. Sign in again to set it up.',
                'TWO_FACTOR_SETUP_REQUIRED',
                403,
            );
        }

        if ($user && $problem) {
            if ($request->hasSession()) {
                Auth::guard('web')->logout();       // also forgets the "keep me signed in" cookie
                $request->session()->invalidate();
                $request->session()->regenerateToken();
            }

            throw $problem; // 403 ACCOUNT_INACTIVE or COMPANY_SUSPENDED
        }

        return $next($request);
    }
}
