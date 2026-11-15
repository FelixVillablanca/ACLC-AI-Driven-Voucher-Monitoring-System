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
            DemoDataSeeder::class,
        ]);
    }
}
