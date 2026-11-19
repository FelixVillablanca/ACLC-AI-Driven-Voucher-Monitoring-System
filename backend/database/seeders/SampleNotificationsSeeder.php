<?php

namespace Database\Seeders;

use App\Models\Notification;
use App\Models\User;
use Illuminate\Database\Seeder;
use RuntimeException;

/**
 * SAMPLE NOTIFICATIONS for every admin, matching the Framer design (D7aTKQEDz),
 * so the bell panel has something to show in the testing database.
 *
 *   php artisan db:seed --class=SampleNotificationsSeeder --env=testing
 *
 * Re-running it replaces each admin's sample notifications (no duplicates).
 * Real notifications will be created by the app itself as features are built.
 */
class SampleNotificationsSeeder extends Seeder
{
    /** [type, title, message, minutes ago, is_read] */
    private const SAMPLES = [
        ['security_alert', '5 failed sign-in attempts', 'Account m.santos was locked after repeated failed logins from 192.168.1.24.', 2, false],
        ['access_changed', '3 users have no company access', 'They can’t work in any company until access is granted.', 5, false],
        ['user_changed', 'New user account created', 'Juan Dela Cruz (Accounting Clerk) was added to Apex Holdings.', 10, false],
        ['access_changed', 'Company access granted', 'Ana Reyes can now access Northwind Trading.', 60, false],
        ['department_alert', 'Finance Operations has no department head', 'Apex Holdings · Assign a head to route approvals correctly.', 60 * 20, true],
        ['company_changed', 'Sunrise Logistics was deactivated', '3 users lost access to this company.', 60 * 24 * 2, true],
    ];

    public function run(): void
    {
        if (app()->environment('production')) {
            throw new RuntimeException('SampleNotificationsSeeder must not run in production.');
        }

        foreach (User::where('role', 'admin')->get() as $admin) {
            $titles = array_column(self::SAMPLES, 1);
            Notification::for($admin)->whereIn('title', $titles)->delete();

            foreach (self::SAMPLES as [$type, $title, $message, $minutesAgo, $isRead]) {
                $notification = new Notification([
                    'recipient_id' => $admin->id,
                    'type' => $type,
                    'title' => $title,
                    'message' => $message,
                    'is_read' => $isRead,
                ]);
                $notification->created_at = $notification->updated_at = now()->subMinutes($minutesAgo);
                $notification->save();
            }

            $this->command?->info("  {$admin->email}: ".count(self::SAMPLES).' sample notifications');
        }
    }
}
