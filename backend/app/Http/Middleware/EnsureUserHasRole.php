<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * ROLE GUARD for a whole group of routes:
 *
 *   Route::middleware('role:admin')->group(...)
 *   Route::middleware('role:accounting_officer,supervisor_manager')->group(...)
 *
 * Wrong role -> 403 (the standard error JSON). This is the REAL security check;
 * the React RequireRole guard only hides pages for a nicer experience.
 * Rules about ONE record ("may this officer approve THIS voucher?") go in Policies instead.
 */
class EnsureUserHasRole
{
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        if (! in_array($request->user()?->role, $roles, true)) {
            throw new AuthorizationException('You do not have permission to do this.');
        }

        return $next($request);
    }
}
