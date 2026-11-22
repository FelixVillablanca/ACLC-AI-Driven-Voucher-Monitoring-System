<?php

namespace App\Domain\Identity\Account;

use App\Domain\Audit\AuditTrail;
use App\Domain\Security\Support\DeviceLabel;
use App\Exceptions\ApiException;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * "Where you're signed in" (Account settings). Sessions live in the `sessions` table
 * (SESSION_DRIVER=database): one row per browser that is signed in.
 *
 * A session ID is as good as a password (whoever has it IS signed in), so it never leaves
 * the server. The screen gets a KEY instead: a one-way fingerprint (SHA-256) of the ID.
 * We can match a key back to a row, but nobody can turn a key back into an ID.
 */
class OwnSessions
{
    /** @return array<int, array{key: string, device: ?string, ip: ?string, last_active_at: string, current: bool}> */
    public function list(User $user, string $currentSessionId): array
    {
        return DB::table('sessions')->where('user_id', $user->id)
            ->where('last_activity', '>=', now()->subMinutes((int) config('session.lifetime'))->timestamp)
            ->orderByDesc('last_activity')
            ->get(['id', 'ip_address', 'user_agent', 'last_activity'])
            ->map(fn ($row) => [
                'key' => self::key($row->id),
                'device' => DeviceLabel::from($row->user_agent),
                'ip' => $row->ip_address,
                'last_active_at' => Carbon::createFromTimestamp($row->last_activity, config('app.timezone'))->toIso8601String(),
                'current' => hash_equals($row->id, $currentSessionId),
            ])
            // this browser first
            ->sortByDesc('current')->values()->all();
    }

    /** Signs out ONE other browser. 404 when it already ended; 409 for this browser (use Sign out instead). */
    public function signOut(User $user, string $key, string $currentSessionId, ?string $ip): void
    {
        $row = DB::table('sessions')->where('user_id', $user->id)->get(['id', 'user_agent'])
            ->first(fn ($r) => hash_equals(self::key($r->id), $key));

        if (! $row) {
            throw new ApiException('That device is already signed out.', 'SESSION_NOT_FOUND', 404);
        }
        if (hash_equals($row->id, $currentSessionId)) {
            throw new ApiException('This is the browser you are using now. Use Sign out in the account menu instead.', 'CURRENT_SESSION', 409);
        }

        DB::table('sessions')->where('id', $row->id)->delete();
        $this->audit($user, 'session_signed_out', ['device' => DeviceLabel::from($row->user_agent)], $ip);
    }

    /** Signs out every browser except this one. Returns how many were signed out. */
    public function signOutOthers(User $user, string $currentSessionId, ?string $ip, bool $audit = true): int
    {
        $count = DB::table('sessions')->where('user_id', $user->id)->where('id', '!=', $currentSessionId)->delete();

        // Also cancel "keep me signed in" cookies, or a closed browser would sign itself back in.
        // (This browser stays signed in through its session.)
        $user->forceFill(['remember_token' => Str::random(60)])->saveQuietly();

        if ($audit) {
            $this->audit($user, 'sessions_signed_out', ['count' => $count], $ip);
        }

        return $count;
    }

    public static function key(string $sessionId): string
    {
        return substr(hash('sha256', 'session-key|'.$sessionId), 0, 32);
    }

    private function audit(User $user, string $action, array $values, ?string $ip): void
    {
        AuditTrail::record([
            'user_id' => $user->id,
            'company_id' => $user->company_id,
            'action' => $action,
            'table_name' => 'users',
            'record_id' => $user->id,
            'new_values' => $values,
            'ip_address' => $ip,
        ]);
    }
}
