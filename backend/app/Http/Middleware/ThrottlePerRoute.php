<?php

namespace App\Http\Middleware;

use Illuminate\Routing\Middleware\ThrottleRequests;

/**
 * Registered as the `throttle` alias (bootstrap/app.php, 2026-11-28), so routes keep writing `throttle:6,1`.
 *
 * Laravel's own unnamed throttle keys its counter by the USER only (or the IP for guests). Every route using
 * `throttle:N,1` therefore shared ONE counter per person: a clerk's draft saves (60/min) used up the 6-a-minute
 * allowance of an unrelated action such as changing their password. Adding the route to the key gives each action
 * its own counter, still per person / per IP. Named limiters (`throttle:api`, `throttle:email-payee`, …) are not
 * affected: they use the key their RateLimiter::for() definition builds.
 */
class ThrottlePerRoute extends ThrottleRequests
{
    protected function resolveRequestSignature($request)
    {
        $route = $request->route();
        $scope = $route?->getName() ?? $request->method().' '.($route?->uri() ?? $request->path());

        return sha1($scope.'|'.parent::resolveRequestSignature($request));
    }
}
