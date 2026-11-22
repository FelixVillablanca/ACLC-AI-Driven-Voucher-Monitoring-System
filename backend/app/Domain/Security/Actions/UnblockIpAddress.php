<?php

namespace App\Domain\Security\Actions;

use App\Domain\Audit\AuditTrail;
use App\Domain\Security\Support\OwnerActivity;
use App\Exceptions\ApiException;
use App\Models\BlockedIp;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Unblock an address (Audit logs AL2 banner; System health SH9).
 * `$watch` = "Watch it for 24 hours": 3 failed sign-ins in that time block it again (ReblockWatchedAddress).
 */
class UnblockIpAddress
{
    public function handle(User $by, BlockedIp $block, ?string $ip, bool $watch = false): BlockedIp
    {
        return DB::transaction(function () use ($by, $block, $ip, $watch) {
            $block = BlockedIp::whereKey($block->id)->lockForUpdate()->firstOrFail();
            if (! BlockedIp::whereKey($block->id)->active()->exists()) {
                throw new ApiException("{$block->ip_address} isn’t blocked any more.", 'IP_NOT_BLOCKED', 409);
            }

            $block->forceFill(['unblocked_at' => now(), 'unblocked_by' => $by->id, 'watch_until' => $watch ? now()->addDay() : null])->save();

            AuditTrail::record([
                'user_id' => $by->id,
                'action' => 'ip_unblocked',
                'table_name' => 'blocked_ips',
                'record_id' => $block->id,
                'old_values' => ['ip_address' => $block->ip_address, 'reason' => $block->reason],
                'new_values' => ['watch_24h' => $watch],
                'ip_address' => $ip,
            ]);

            OwnerActivity::tellOtherOwners($by, 'security_alert', 'IP address unblocked',
                "{$by->full_name} unblocked {$block->ip_address}.");

            return $block;
        });
    }
}
