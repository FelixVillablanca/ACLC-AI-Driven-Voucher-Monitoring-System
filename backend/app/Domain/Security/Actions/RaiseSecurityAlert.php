<?php

namespace App\Domain\Security\Actions;

use App\Models\Notification;
use App\Models\SecurityAlert;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Saves a new security alert and rings the bell (a security_alert notification) for
 * every active Super Admin, so nobody has to keep the panel open to notice it.
 */
class RaiseSecurityAlert
{
    /**
     * @param  array<string, mixed>  $attributes  columns of security_alerts
     * @param  array<int, int>  $dontNotify  Super Admin ids that shouldn't get the bell (e.g. the person it's about)
     */
    public function handle(array $attributes, string $title, string $message, array $dontNotify = []): SecurityAlert
    {
        return DB::transaction(function () use ($attributes, $title, $message, $dontNotify) {
            $alert = SecurityAlert::create([
                'status' => 'open',
                'event_count' => 1,
                'first_seen_at' => now(),
                'last_seen_at' => now(),
                ...$attributes,
            ]);

            User::where('role', 'super_admin')
                ->where('is_active', true)
                ->whereNotIn('id', $dontNotify)
                ->pluck('id')
                ->each(fn (int $id) => Notification::create([
                    'recipient_id' => $id,
                    'type' => 'security_alert',
                    'title' => $title,
                    'message' => $message,
                ]));

            return $alert;
        });
    }
}
