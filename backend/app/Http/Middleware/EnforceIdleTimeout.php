<?php

namespace App\Http\Middleware;

use App\Domain\Platform\SystemSettings;
use App\Exceptions\ApiException;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

/**
 * IDLE TIMEOUT for Super Admins (spec §4.6: "shorter session lifetime than other roles").
 *
 * The session remembers when the person last DID something. If a Super Admin has been
 * idle longer than the limit (Global setting, 15 minutes to start), the next request
 * signs them out with 401 SESSION_EXPIRED and the app shows "You were signed out…".
 *
 * Automatic refreshes (the page re-checking numbers every minute) send the header
 * X-Background-Refresh: 1. They do NOT count as activity, otherwise an open tab
 * would keep the session alive forever.
 *
 * Other roles keep the normal session length (SESSION_LIFETIME in .env).
 */
class EnforceIdleTimeout
{
    public const SESSION_KEY = 'last_activity_at';

    public const BACKGROUND_HEADER = 'X-Background-Refresh';

    public function __construct(private SystemSettings $settings) {}

    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user || $user->role !== 'super_admin' || ! $request->hasSession()) {
            return $next($request);
        }

        $session = $request->session();
        $minutes = (int) $this->settings->get(
            SystemSettings::SUPER_ADMIN_IDLE_TIMEOUT,
            SystemSettings::DEFAULTS[SystemSettings::SUPER_ADMIN_IDLE_TIMEOUT]['value'],
        );
        $lastActivity = $session->get(self::SESSION_KEY);

        if ($lastActivity && now()->timestamp - $lastActivity > $minutes * 60) {
            Auth::guard('web')->logout();
            $session->invalidate();
            $session->regenerateToken();

            throw new ApiException(
                "You were signed out after {$minutes} minutes without activity. Please sign in again.",
                'SESSION_EXPIRED',
                401,
            );
        }

        if (! $lastActivity || $request->header(self::BACKGROUND_HEADER) !== '1') {
            $session->put(self::SESSION_KEY, now()->timestamp);
        }

        return $next($request);
    }
}
