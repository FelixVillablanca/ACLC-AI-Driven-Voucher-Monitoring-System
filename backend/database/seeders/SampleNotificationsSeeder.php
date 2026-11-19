<?php

namespace Database\Seeders;

use App\Models\Notification;
use App\Models\User;
use Illuminate\Database\Seeder;
use RuntimeException;

/**
 * SAMPLE NOTIFICATIONS for every admin and Super Admin, matching the Framer design (D7aTKQEDz),
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

    /** Super Admin samples (Framer uH0wO9f5O "Needs your attention" + bell). Unread security alerts show on the landing page. */
    private const SUPER_ADMIN_SAMPLES = [
        ['security_alert', '5 failed sign-ins for johndoe@Administrator.com', 'From 180.190.77.4 in 3 minutes. The account is still active.', 15, false],
        ['security_alert', 'Sign-in from a new device', 'Liza Santos (Admin) signed in from a new browser.', 60 * 3, false],
        ['user_changed', 'Admin account created', 'Carlo Reyes was added as an Admin.', 60 * 6, true],
    ];

    public function run(): void
    {
        if (app()->environment('production')) {
            throw new RuntimeException('SampleNotificationsSeeder must not run in production.');
        }

        foreach (User::whereIn('role', ['admin', 'super_admin'])->get() as $admin) {
            $samples = $admin->role === 'super_admin' ? self::SUPER_ADMIN_SAMPLES : self::SAMPLES;
            Notification::for($admin)->whereIn('title', array_column($samples, 1))->delete();

            foreach ($samples as [$type, $title, $message, $minutesAgo, $isRead]) {
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

            $this->command?->info("  {$admin->email}: ".count($samples).' sample notifications');
        }
    }
}
