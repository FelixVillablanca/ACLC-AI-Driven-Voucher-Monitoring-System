<?php

namespace App\Domain\Security\Actions;

use App\Domain\Audit\AuditTrail;
use App\Models\BlockedIp;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * SH9 "Watch it for 24 hours": after an address is unblocked with watching on, 3 failed sign-ins
 * from it before the watch ends block it again (7 days) automatically, and every Super Admin is told.
 * Called by WatchSignIns after each failed sign-in.
 */
class ReblockWatchedAddress
{
    public const FAILURES = 3;

    public const REBLOCK_HOURS = 168; // 7 days

    public function check(?string $ip): bool
    {
        if ($ip === null) {
            return false;
        }

        return DB::transaction(function () use ($ip) {
            $watched = BlockedIp::where('ip_address', $ip)->whereNotNull('unblocked_at')
                ->where('watch_until', '>', now())->latest('id')->lockForUpdate()->first();
            if (! $watched || BlockedIp::where('ip_address', $ip)->active()->exists()) {
                return false;
            }

            $failures = DB::table('audit_logs')->where('ip_address', $ip)->where('action', 'login_failed')
                ->where('created_at', '>=', $watched->unblocked_at)->count();
            if ($failures < self::FAILURES) {
                return false;
            }

            $block = BlockedIp::create([
                'ip_address' => $ip,
                'reason' => 'Blocked again automatically: '.self::FAILURES.' failed sign-ins while it was being watched after an unblock.',
                'expires_at' => now()->addHours(self::REBLOCK_HOURS),
                'blocked_by' => null, // the system
            ]);
            $watched->forceFill(['watch_until' => null])->save();

            AuditTrail::record([
                'action' => 'ip_blocked',
                'table_name' => 'blocked_ips',
                'record_id' => $block->id,
                'new_values' => ['ip_address' => $ip, 'duration' => '7d', 'reason' => $block->reason, 'automatic' => true],
            ]);

            User::where('role', 'super_admin')->where('is_active', true)->pluck('id')
                ->each(fn (int $id) => Notification::create([
                    'recipient_id' => $id,
                    'type' => 'security_alert',
                    'title' => "{$ip} was blocked again",
                    'message' => self::FAILURES.' failed sign-ins came from it within 24 hours of being unblocked. It is blocked for 7 days.',
                ]));

            return true;
        });
    }
}
