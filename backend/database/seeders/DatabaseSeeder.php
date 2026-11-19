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
            DemoDataSeeder::class,    // companies, departments, 4 demo logins
            SampleUsersSeeder::class, // your own extra users (edit the list in that file)
            SampleNotificationsSeeder::class, // bell-panel samples for every admin
        ]);
    }
}
