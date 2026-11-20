<?php

namespace App\Domain\Security\Actions;

use App\Domain\Security\Support\DeviceLabel;
use App\Models\SecurityAlert;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Writes every sign-in (good or bad) to the audit log and applies the two sign-in RULES:
 *
 *   1. "5 or more failed sign-ins in 5 minutes" for the same email  -> HIGH alert.
 *      More failures while that alert is still open are added to it (no pile of copies).
 *   2. An Admin or Super Admin signs in from a browser/system they have never used -> MEDIUM alert.
 *      Their very first recorded sign-in is the starting point, so it never alerts.
 *
 * The person signing in never notices any of this: the answer they get is the same.
 */
class WatchSignIns
{
    public const FAILED_LIMIT = 5;

    public const FAILED_WINDOW_MINUTES = 5;

    /** Failures within this long after the last one are added to the same open alert. */
    private const MERGE_MINUTES = 60;

    /** "What happened" keeps at most this many attempts. */
    private const MAX_EVENTS = 50;

    /** New-device alerts only for the accounts that can change the system. */
    private const WATCHED_ROLES = ['admin', 'super_admin'];

    public function __construct(private RaiseSecurityAlert $raise) {}

    /** @param  string  $reason  wrong_password | unknown_email */
    public function failed(string $email, ?User $user, string $reason, ?string $ip, ?string $userAgent): void
    {
        $email = Str::lower(trim($email));
        $device = DeviceLabel::from($userAgent);

        $this->audit('login_failed', $user, ['email' => $email, 'reason' => $reason, 'device' => $device], $ip, $userAgent);

        $since = now()->subMinutes(self::FAILED_WINDOW_MINUTES);
        $recent = $this->failuresFor($email)->where('created_at', '>=', $since)->count();

        if ($recent < self::FAILED_LIMIT) {
            return;
        }

        // A LOCK so two failures arriving at the same moment can't both create an alert.
        Cache::lock('security-alert:failed:'.$email, 10)->block(5, function () use ($email, $user, $reason, $ip, $device, $since) {
            $event = ['at' => now()->toIso8601String(), 'reason' => $reason, 'ip' => $ip, 'device' => $device];

            $open = SecurityAlert::open()
                ->where('type', SecurityAlert::TYPE_FAILED_SIGN_INS)
                ->where('subject_email', $email)
                ->where('last_seen_at', '>=', now()->subMinutes(self::MERGE_MINUTES))
                ->latest('id')
                ->first();

            if ($open) {
                $events = $open->details['events'] ?? [];
                $events[] = $event;
                $open->update([
                    'event_count' => $open->event_count + 1,
                    'last_seen_at' => now(),
                    'ip_address' => $ip,
                    'device' => $device,
                    'details' => ['events' => array_slice($events, -self::MAX_EVENTS)],
                ]);

                return;
            }

            // The failures that crossed the line become the alert's "What happened" list
            $rows = $this->failuresFor($email)->where('created_at', '>=', $since)->orderBy('id')->get(['created_at', 'new_values', 'ip_address']);
            $events = $rows->map(function ($row) {
                $values = json_decode($row->new_values, true) ?? [];

                return [
                    'at' => Carbon::parse($row->created_at)->toIso8601String(),
                    'reason' => $values['reason'] ?? 'wrong_password',
                    'ip' => $row->ip_address,
                    'device' => $values['device'] ?? null,
                ];
            })->all();

            $this->raise->handle([
                'type' => SecurityAlert::TYPE_FAILED_SIGN_INS,
                'severity' => 'high',
                'user_id' => $user?->id,
                'subject_email' => $email,
                'ip_address' => $ip,
                'device' => $device,
                'event_count' => count($events),
                'first_seen_at' => $rows->first()?->created_at ?? now(),
                'last_seen_at' => now(),
                'details' => ['events' => $events],
            ], count($events).' failed sign-ins', "Someone failed to sign in as {$email} ".count($events).' times'.($ip ? " from {$ip}" : '').'.');
        });
    }

    public function succeeded(User $user, ?string $ip, ?string $userAgent): void
    {
        $device = DeviceLabel::from($userAgent);

        $earlier = DB::table('audit_logs')->where('action', 'login')->where('user_id', $user->id);
        $hasHistory = (clone $earlier)->exists();
        $knownDevice = $device === null || (clone $earlier)->where('new_values->device', $device)->exists();
        $knownIp = $ip === null || (clone $earlier)->where('ip_address', $ip)->exists();

        $this->audit('login', $user, ['device' => $device], $ip, $userAgent);

        if (! $hasHistory || $knownDevice || ! in_array($user->role, self::WATCHED_ROLES, true)) {
            return;
        }

        $this->raise->handle([
            'type' => SecurityAlert::TYPE_NEW_DEVICE,
            'severity' => 'medium',
            'user_id' => $user->id,
            'subject_email' => Str::lower($user->email),
            'ip_address' => $ip,
            'device' => $device,
            'details' => ['ip_seen_before' => $knownIp],
        ], 'Sign-in from a new device', "{$user->full_name} signed in with {$device}".($ip ? " from {$ip}" : '').' for the first time.', [$user->id]);
    }

    /** Failed sign-ins for this email (the email is inside the audit row's JSON). */
    private function failuresFor(string $email)
    {
        return DB::table('audit_logs')->where('action', 'login_failed')->where('new_values->email', $email);
    }

    private function audit(string $action, ?User $user, array $values, ?string $ip, ?string $userAgent): void
    {
        DB::table('audit_logs')->insert([
            'user_id' => $user?->id,
            'company_id' => $user?->company_id,
            'action' => $action,
            'table_name' => 'users',
            'record_id' => $user?->id,
            'old_values' => null,
            'new_values' => json_encode($values),
            'ip_address' => $ip,
            'user_agent' => $userAgent ? Str::limit($userAgent, 500, '') : null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
}
