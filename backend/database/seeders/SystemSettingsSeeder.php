<?php

namespace Database\Seeders;

use App\Domain\Platform\SystemSettings;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * PLATFORM DEFAULTS: the starting value of every global rule (SystemSettings::DEFAULTS).
 *
 *   php artisan db:seed --class=SystemSettingsSeeder --env=testing   (testing DB)
 *   php artisan db:seed --class=SystemSettingsSeeder                 (real DB)
 *
 * Unlike the Sample* seeders this is NOT fake data: it is the platform's real starting setup,
 * so it may run on the real database too.
 *
 * SAFE TO RUN AGAIN: it only adds settings that don't exist yet. A value a Super Admin
 * already saved is never overwritten. When it adds something, it writes ONE audit-log row
 * "Platform defaults applied" (done by the system, platform-level), which is the
 * "System" entry in the Change history design (Framer OtA4G9A9F).
 */
class SystemSettingsSeeder extends Seeder
{
    public function run(): void
    {
        DB::transaction(function () {
            $existing = DB::table('system_settings')->pluck('key')->all();
            $missing = array_diff_key(SystemSettings::DEFAULTS, array_flip($existing));

            if ($missing === []) {
                $this->command?->info('  All global settings already exist; nothing changed.');

                return;
            }

            $now = now();
            foreach ($missing as $key => $setting) {
                DB::table('system_settings')->insert([
                    'key' => $key,
                    'value' => json_encode($setting['value']),
                    'group' => $setting['group'],
                    'description' => $setting['description'],
                    'updated_by' => null, // set by the system, not a person
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }

            DB::table('audit_logs')->insert([
                'user_id' => null,
                'company_id' => null,
                'action' => 'defaults_applied',
                'table_name' => 'system_settings',
                'record_id' => null,
                'old_values' => null,
                'new_values' => json_encode(array_map(fn ($s) => $s['value'], $missing)),
                'ip_address' => null,
                'user_agent' => null,
                'created_at' => $now,
                'updated_at' => $now,
            ]);

            $this->command?->info('  Added '.count($missing).' global settings: '.implode(', ', array_keys($missing)));
        });
    }
}
