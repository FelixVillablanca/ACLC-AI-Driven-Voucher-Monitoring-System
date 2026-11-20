<?php

namespace App\Domain\Security\Support;

use App\Exceptions\ApiException;
use App\Models\Notification;
use App\Models\SecurityAlert;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Small shared steps used by the Super Admin's account actions (Lock, Unlock, Reset password)
 * and the alert actions (Review, Dismiss). Kept in one place so each action reads like a list.
 */
class OwnerActivity
{
    /**
     * Ends every session of this person on every device (sessions are stored in the database,
     * SESSION_DRIVER=database) and cancels their "keep me signed in" cookie.
     */
    public static function signOutEverywhere(User $user): void
    {
        DB::table('sessions')->where('user_id', $user->id)->delete();
        $user->forceFill(['remember_token' => Str::random(60)])->saveQuietly();
    }

    /** One audit_logs row for something a Super Admin did. */
    public static function audit(User $by, string $action, string $table, ?int $recordId, ?array $old, ?array $new, ?string $ip, ?int $companyId = null): void
    {
        DB::table('audit_logs')->insert([
            'user_id' => $by->id,
            'company_id' => $companyId,
            'action' => $action,
            'table_name' => $table,
            'record_id' => $recordId,
            'old_values' => $old === null ? null : json_encode($old),
            'new_values' => $new === null ? null : json_encode($new),
            'ip_address' => $ip,
            'user_agent' => null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    /** The bell for the OTHER active Super Admins (spec §4: sensitive changes are announced). */
    public static function tellOtherOwners(User $by, string $type, string $title, string $message): void
    {
        User::where('role', 'super_admin')->where('is_active', true)->whereKeyNot($by->id)->pluck('id')
            ->each(fn (int $id) => Notification::create([
                'recipient_id' => $id, 'type' => $type, 'title' => $title, 'message' => $message,
            ]));
    }

    /**
     * After Lock / Reset password: mark the alert reviewed, unless someone already closed it
     * (that's fine here: the account action itself still counts).
     */
    public static function closeAlertIfOpen(int $alertId, User $by, ?string $ip): void
    {
        $open = SecurityAlert::whereKey($alertId)->open()->lockForUpdate()->exists();
        if ($open) {
            self::closeAlert($alertId, $by, 'reviewed', $ip);
        }
    }

    /**
     * Closes an alert (reviewed or dismissed). Locks the row first so two Super Admins
     * clicking at the same moment can't both close it: the second one gets 409.
     */
    public static function closeAlert(int $alertId, User $by, string $status, ?string $ip): SecurityAlert
    {
        /** @var SecurityAlert $alert */
        $alert = SecurityAlert::whereKey($alertId)->lockForUpdate()->firstOrFail();

        if (! $alert->isOpen()) {
            $who = $alert->reviewer?->full_name ?? 'another Super Admin';
            throw new ApiException("This alert was already {$alert->status} by {$who}.", 'ALERT_ALREADY_CLOSED', 409);
        }

        $alert->update(['status' => $status, 'reviewed_by' => $by->id, 'reviewed_at' => now()]);
        self::audit($by, 'security_alert_'.$status, 'security_alerts', $alert->id, ['status' => 'open'], ['status' => $status], $ip);

        return $alert;
    }
}
