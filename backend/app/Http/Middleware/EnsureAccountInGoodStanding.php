<?php

namespace App\Http\Middleware;

use App\Domain\Identity\Support\AccountStanding;
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

        if ($user && ($problem = AccountStanding::problem($user))) {
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
