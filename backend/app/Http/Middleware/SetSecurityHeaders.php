<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Security headers on EVERY response (Phase 7, step 1, 2026-11-28). The API only answers JSON and files, so the
 * rules can be strict:
 *   X-Content-Type-Options: nosniff        the browser never guesses a type (a JSON or CSV answer can't run as a page)
 *   X-Frame-Options: DENY + CSP frame-ancestors 'none'   no other site can show ADVMS inside a frame (clickjacking)
 *   Referrer-Policy: strict-origin-when-cross-origin      full addresses (with ids) never leak to other sites
 *   Permissions-Policy                     no camera, microphone, location, payment… for anything the API serves
 *   Content-Security-Policy                API answers may load nothing at all (default-src 'none')
 *   Cross-Origin-Opener-Policy / Resource-Policy   other sites can't open or embed what the API serves
 *   Strict-Transport-Security              only over HTTPS (production): browsers then refuse plain HTTP for a year
 * A header the route already set is left alone (a PDF download keeps its own Content-Type / Disposition).
 */
class SetSecurityHeaders
{
    private const HEADERS = [
        'X-Content-Type-Options' => 'nosniff',
        'X-Frame-Options' => 'DENY',
        'Referrer-Policy' => 'strict-origin-when-cross-origin',
        'Permissions-Policy' => 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
        'Content-Security-Policy' => "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
        'Cross-Origin-Opener-Policy' => 'same-origin',
        'Cross-Origin-Resource-Policy' => 'same-site', // app. and api. of one domain may share files
    ];

    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        foreach (self::HEADERS as $name => $value) {
            if (! $response->headers->has($name)) {
                $response->headers->set($name, $value);
            }
        }
        if ($request->isSecure()) {
            $response->headers->set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
        }
        $response->headers->remove('X-Powered-By'); // don't advertise the PHP version
        if (! headers_sent()) {
            header_remove('X-Powered-By'); // PHP adds it itself when expose_php is on
        }

        return $response;
    }
}
