<?php

namespace App\Http\Middleware;

use App\Exceptions\ApiException;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Alias `admin.company`, on the /api/v1/admin/* group. Since 2026-11-28 an Admin may be created with
 * "No company yet" (user decision): until a Super Admin gives them one, everything in the Admin console is
 * about a company they don't have, so it answers 403 NO_COMPANY_YET (the React app shows a waiting page).
 * Their own account pages (/account), notifications and sign-out are outside this group and keep working.
 */
class EnsureAdminHasCompany
{
    public function handle(Request $request, Closure $next): Response
    {
        if ($request->user()?->role === 'admin' && $request->user()->company_id === null) {
            throw new ApiException(
                'Your account has no company yet. A Super Admin will assign you one; you’ll get a notice when they do.',
                'NO_COMPANY_YET',
                403,
            );
        }

        return $next($request);
    }
}
