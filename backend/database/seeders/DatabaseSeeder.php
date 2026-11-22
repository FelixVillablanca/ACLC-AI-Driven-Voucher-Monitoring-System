<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

/**
 * The MAIN seeder. `php artisan db:seed` runs this file, and it decides
 * which other seeders to run, in order.
 */
class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([
            SystemSettingsSeeder::class, // platform defaults (real starting values, safe on any DB)
            DemoDataSeeder::class,    // companies, departments, 4 demo logins
            SampleUsersSeeder::class, // your own extra users (edit the list in that file)
            SampleNotificationsSeeder::class, // bell-panel samples for every admin
            SampleAuditLogsSeeder::class, // a few audit entries for today (Audit logs tab), added once
        ]);
    }
}
