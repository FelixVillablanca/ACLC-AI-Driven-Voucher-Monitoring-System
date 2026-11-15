<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

/**
 * Gives every request a TRACKING NUMBER (like a parcel tracking code).
 * - It is sent back in the "X-Request-ID" header and inside every error.
 * - Every log line for this request includes it.
 * So when a user reports "error 01JD3X...", we can find exactly what happened.
 */
class AssignRequestId
{
    public function handle(Request $request, Closure $next): Response
    {
        $id = $request->headers->get('X-Request-ID');

        // Only trust a client-sent ID if it looks safe; otherwise make our own
        if (! is_string($id) || ! preg_match('/^[A-Za-z0-9-]{8,64}$/', $id)) {
            $id = (string) Str::ulid();
        }

        $request->attributes->set('request_id', $id);
        Log::withContext(['request_id' => $id]);

        $response = $next($request);
        $response->headers->set('X-Request-ID', $id);

        return $response;
    }
}
