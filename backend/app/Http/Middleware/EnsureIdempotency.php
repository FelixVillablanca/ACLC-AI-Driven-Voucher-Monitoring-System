<?php

namespace App\Http\Middleware;

use App\Exceptions\ApiException;
use Closure;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

/**
 * Idempotency (Phase 7 step 1, 2026-11-28; table idempotency_keys). On a signed-in POST that carries an
 * Idempotency-Key header:
 *   first time            the request runs; a successful (2xx) JSON answer is kept for 24 h
 *   same key + same ask   that answer is sent back again (header Idempotent-Replayed: true): nothing is done twice
 *   same key, still busy  409 REQUEST_IN_PROGRESS (the first click is still being handled)
 *   same key, other ask   422 IDEMPOTENCY_KEY_REUSED
 * A failed answer (4xx / 5xx) or a file / non-JSON one is not kept, so trying again simply runs again.
 * No header (old clients, tests) = no change. Expired rows are removed by `php artisan idempotency:prune` (scheduled).
 */
class EnsureIdempotency
{
    public const TTL_HOURS = 24;

    public function handle(Request $request, Closure $next): Response
    {
        $key = $request->header('Idempotency-Key');
        $user = $request->user();
        if ($request->method() !== 'POST' || ! $key || ! $user) {
            return $next($request);
        }
        if (! preg_match('/^[A-Za-z0-9_\-:.]{8,100}$/', $key)) {
            throw new ApiException('The Idempotency-Key header must be 8–100 letters, digits or - _ : .', 'IDEMPOTENCY_KEY_INVALID', 400);
        }

        $hash = $this->fingerprint($request);
        $existing = $this->claim($user->id, $key, $request, $hash);
        if ($existing) {
            return $this->answerFor($existing, $hash);
        }

        try {
            $response = $next($request);
        } catch (\Throwable $e) {
            $this->release($user->id, $key);
            throw $e;
        }

        $json = str_contains((string) $response->headers->get('Content-Type'), 'json');
        if ($response->isSuccessful() && $json) {
            DB::table('idempotency_keys')->where('user_id', $user->id)->where('key', $key)
                ->update(['status_code' => $response->getStatusCode(), 'response_body' => $response->getContent(), 'updated_at' => now()]);
        } else {
            $this->release($user->id, $key);
        }

        return $response;
    }

    /** Insert the key (we're first: null back), or return the row someone already made with it. */
    private function claim(int $userId, string $key, Request $request, string $hash): ?object
    {
        $row = fn () => DB::table('idempotency_keys')->where('user_id', $userId)->where('key', $key)->where('expires_at', '>', now())->first();
        // an expired row with the same key may be reused
        DB::table('idempotency_keys')->where('user_id', $userId)->where('key', $key)->where('expires_at', '<=', now())->delete();
        try {
            DB::table('idempotency_keys')->insert([
                'user_id' => $userId, 'key' => $key, 'method' => $request->method(), 'path' => mb_substr($request->path(), 0, 255),
                'request_hash' => $hash, 'expires_at' => now()->addHours(self::TTL_HOURS), 'created_at' => now(), 'updated_at' => now(),
            ]);

            return null;
        } catch (QueryException $e) {
            if (($e->errorInfo[1] ?? null) !== 1062) { // not "duplicate key"
                throw $e;
            }

            return $row() ?? throw $e;
        }
    }

    private function answerFor(object $row, string $hash): Response
    {
        if (! hash_equals($row->request_hash, $hash)) {
            throw new ApiException('This Idempotency-Key was already used for a different request.', 'IDEMPOTENCY_KEY_REUSED', 422);
        }
        if ($row->status_code === null) {
            throw new ApiException('This request is already being handled. Wait a moment, then refresh.', 'REQUEST_IN_PROGRESS', 409);
        }

        return response((string) $row->response_body, (int) $row->status_code, [
            'Content-Type' => 'application/json',
            'Idempotent-Replayed' => 'true',
        ]);
    }

    private function release(int $userId, string $key): void
    {
        DB::table('idempotency_keys')->where('user_id', $userId)->where('key', $key)->whereNull('status_code')->delete();
    }

    /** What was asked: method, path, company and body (uploaded files by their content). */
    private function fingerprint(Request $request): string
    {
        $files = collect($request->allFiles())->flatten()->map(fn ($f) => hash_file('sha256', $f->getRealPath()))->values()->all();

        return hash('sha256', json_encode([
            $request->method(), $request->path(), $request->header('X-Company-ID'), $request->except(array_keys($request->allFiles())), $files,
        ]));
    }
}
