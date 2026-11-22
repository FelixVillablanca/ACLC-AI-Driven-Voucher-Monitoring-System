<?php

namespace App\Domain\Security\Queries;

use App\Models\BlockedIp;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * WHAT ONE IP ADDRESS DID TODAY (Framer AL2 banner + AL8 evidence), from the audit log:
 * failed sign-ins, which accounts were tried, successful sign-ins, first seen, and whether it's blocked.
 */
class IpActivity
{
    public function summary(string $ip): array
    {
        $today = Carbon::today();
        $base = fn () => DB::table('audit_logs')->where('ip_address', $ip)->where('created_at', '>=', $today);

        $failed = $base()->where('action', 'login_failed')->get(['new_values', 'user_id']);
        $tried = $failed->map(fn ($r) => Str::lower((string) (json_decode((string) $r->new_values, true)['email'] ?? '')))
            ->filter()->unique()->values();
        $known = User::whereIn(DB::raw('LOWER(email)'), $tried->all())->get(['id', 'first_name', 'last_name', 'email'])
            ->keyBy(fn (User $u) => Str::lower($u->email));

        // real people who signed in from here recently: if any, blocking it would lock them out too
        $usersSeen = DB::table('audit_logs')->where('ip_address', $ip)->where('action', 'login')
            ->where('created_at', '>=', now()->subDays(30))->whereNotNull('user_id')->distinct()->pluck('user_id');

        $block = BlockedIp::where('ip_address', $ip)->active()->latest('id')->first();

        return [
            'ip' => $ip,
            'failed_sign_ins' => $failed->count(),
            'accounts_tried' => $tried->map(fn (string $email) => [
                'email' => $email,
                'exists' => isset($known[$email]),
                'name' => isset($known[$email]) ? $known[$email]->full_name : null,
            ])->all(),
            'successful_sign_ins' => $base()->where('action', 'login')->count(),
            'users_seen_30d' => User::whereIn('id', $usersSeen)->get(['id', 'first_name', 'last_name'])
                ->map(fn (User $u) => ['id' => $u->id, 'full_name' => $u->full_name])->all(),
            'first_seen_today' => ($first = $base()->min('created_at')) ? Carbon::parse($first)->toIso8601String() : null,
            'blocked' => $block ? [
                'id' => $block->id,
                'until' => $block->expires_at?->toIso8601String(), // null = until unblocked
                'reason' => $block->reason,
                'by' => $block->blockedBy?->full_name,
                'refused_since' => DB::table('audit_logs')->where('ip_address', $ip)->where('action', 'login_blocked')
                    ->where('created_at', '>=', $block->created_at)->count(),
            ] : null,
        ];
    }

    /** The real accounts that failed to sign in from this address today (to email them). */
    public function accountsTried(string $ip): Collection
    {
        $emails = DB::table('audit_logs')->where('ip_address', $ip)->where('action', 'login_failed')
            ->where('created_at', '>=', Carbon::today())->pluck('new_values')
            ->map(fn ($json) => Str::lower((string) (json_decode((string) $json, true)['email'] ?? '')))
            ->filter()->unique()->values();

        return User::whereIn(DB::raw('LOWER(email)'), $emails->all())->where('is_active', true)->get();
    }
}
