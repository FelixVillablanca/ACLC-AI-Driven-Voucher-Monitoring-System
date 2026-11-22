<?php

namespace Database\Seeders;

use App\Domain\Audit\AuditTrail;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * SAMPLE audit entries for today, so the Audit logs tab (Framer EJ0asP2ZH) has something to show
 * in the testing database: a role change, failed sign-ins from one address (try searching
 * 180.190.77.4 and "Block this IP"), normal sign-ins and a backup.
 *
 *   php artisan db:seed --class=SampleAuditLogsSeeder --env=testing
 *
 * Never in production. The audit log is append-only, so it only adds its entries ONCE
 * (they carry the request id "req_sample…"); running it again changes nothing.
 */
class SampleAuditLogsSeeder extends Seeder
{
    public function run(): void
    {
        if (app()->environment('production')) {
            return;
        }
        if (DB::table('audit_logs')->where('request_id', 'like', 'req_sample%')->exists()) {
            $this->command?->info('  Sample audit entries already added; nothing changed.');

            return;
        }

        $john = User::where('email', 'johndoe@Administrator.com')->first();
        $maria = User::where('email', 'marialopez@Clerk.com')->first();
        $ana = User::where('email', 'anamendoza@Supervisor.com')->first();
        if (! $john || ! $maria) {
            $this->command?->warn('  SampleUsersSeeder users not found; run it first.');

            return;
        }

        $at = fn (string $time) => now()->setTimeFromTimeString($time)->min(now());
        $chrome = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';
        $entries = [
            ['created_at' => $at('08:05'), 'user_id' => $ana?->id, 'company_id' => $ana?->company_id, 'action' => 'login', 'table_name' => 'users',
                'record_id' => $ana?->id, 'new_values' => ['device' => 'Chrome on Windows'], 'ip_address' => '112.204.20.9', 'user_agent' => $chrome],
            ['created_at' => $at('09:12'), 'user_id' => $john->id, 'company_id' => $john->company_id, 'action' => 'login', 'table_name' => 'users',
                'record_id' => $john->id, 'new_values' => ['device' => 'Chrome on Windows'], 'ip_address' => '112.204.18.7', 'user_agent' => $chrome],
            ['created_at' => $at('09:40'), 'user_id' => $john->id, 'company_id' => $john->company_id, 'action' => 'role_changed', 'table_name' => 'users',
                'record_id' => $maria->id, 'old_values' => ['role' => 'accounting_clerk', 'email' => 'marialopez@Clerk.com'],
                'new_values' => ['role' => 'accounting_officer', 'email' => 'marialopez@Officer.com'], 'ip_address' => '112.204.18.7', 'user_agent' => $chrome],
            ['created_at' => $at('10:02'), 'action' => 'login_failed', 'table_name' => 'users',
                'new_values' => ['email' => 'admin@administrator.com', 'reason' => 'unknown_email', 'device' => 'Firefox on Linux'], 'ip_address' => '180.190.77.4'],
            ['created_at' => $at('10:03'), 'action' => 'login_failed', 'table_name' => 'users',
                'new_values' => ['email' => 'admin@administrator.com', 'reason' => 'unknown_email', 'device' => 'Firefox on Linux'], 'ip_address' => '180.190.77.4'],
            ['created_at' => $at('10:05'), 'action' => 'login_failed', 'table_name' => 'users', 'record_id' => $john->id,
                'new_values' => ['email' => strtolower($john->email), 'reason' => 'wrong_password', 'device' => 'Firefox on Linux'], 'ip_address' => '180.190.77.4'],
            ['created_at' => $at('02:00'), 'action' => 'backup_started', 'table_name' => 'backups', 'new_values' => ['trigger' => 'scheduled']],
        ];

        foreach ($entries as $i => $entry) {
            AuditTrail::record([...$entry, 'request_id' => 'req_sample'.str_pad((string) $i, 4, '0', STR_PAD_LEFT)]);
        }

        $this->command?->info('  Added '.count($entries).' sample audit entries for today.');
    }
}
