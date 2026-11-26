<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

/**
 * The MAIN seeder. `php artisan db:seed` runs this file, and it decides
 * which other seeders to run, in order.
 *
 * Only people, companies and settings are seeded. Notifications and audit-log entries are never
 * made up: the app writes them itself when someone really does something (removed 2026-11-22:
 * the sample notification / audit seeders showed invented events as if they had happened).
 */
class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([
            SystemSettingsSeeder::class, // platform defaults (real starting values, safe on any DB)
            DemoDataSeeder::class,    // companies, 4 demo logins
            SampleCatalogSeeder::class, // departments, voucher categories, voucher types per company (not in production)
            SampleUsersSeeder::class, // your own extra users (edit the list in that file)
        ]);
    }
}
