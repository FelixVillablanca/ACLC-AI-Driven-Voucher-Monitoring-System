<?php

namespace Tests\Feature\Api;

use App\Domain\Platform\SystemHealth;
use App\Domain\Platform\SystemSettings;
use App\Models\Backup;
use App\Models\Company;
use App\Models\Notification;
use App\Models\SecurityAlert;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * GET /api/v1/superadmin/dashboard (Framer uH0wO9f5O, Super Admin landing page v2).
 *
 * Run:  php artisan test --filter=SuperAdminDashboardTest
 */
class SuperAdminDashboardTest extends TestCase
{
    use RefreshDatabase;

    private const URL = '/api/v1/superadmin/dashboard';

    public function test_super_admin_gets_the_platform_counts(): void
    {
        $owner = User::factory()->superAdmin()->create();
        User::factory()->superAdmin()->inactive()->create(); // inactive: doesn't take a seat

        User::factory()->admin()->create(['last_login_at' => now()]);
        User::factory()->admin()->inactive()->create();
        User::factory()->create();                            // a clerk
        User::factory()->officer()->create();

        Company::factory()->create(['name' => 'Apex']);
        Company::factory()->create(['name' => 'Northfield', 'is_active' => false])
            ->forceFill(['suspended_at' => now()->subDay()])->save();

        $this->actingAs($owner)
            ->getJson(self::URL)
            ->assertOk()
            ->assertJsonPath('data.counts.admins', ['total' => 2, 'active' => 1, 'inactive' => 1])
            ->assertJsonPath('data.counts.super_admins', ['active' => 1, 'seats' => 3])
            ->assertJsonPath('data.counts.companies', ['total' => 2, 'active' => 1, 'suspended' => 1])
            ->assertJsonPath('data.counts.users.total', 4); // 2 admins + clerk + officer, Super Admins not counted
    }

    public function test_admin_list_shows_status_with_working_accounts_first(): void
    {
        $owner = User::factory()->superAdmin()->create();
        $gone = User::factory()->admin()->inactive()->create(['first_name' => 'Mark', 'last_login_at' => now()]);
        $new = User::factory()->admin()->create(['first_name' => 'Carlo', 'last_login_at' => null, 'created_at' => now()->subHour()]);
        $active = User::factory()->admin()->create(['first_name' => 'John', 'last_login_at' => now()->subMinutes(5)]);

        $this->actingAs($owner)
            ->getJson(self::URL)
            ->assertOk()
            ->assertJsonPath('data.admins.0.id', $active->id)
            ->assertJsonPath('data.admins.0.status', 'active')
            ->assertJsonPath('data.admins.1.id', $new->id)
            ->assertJsonPath('data.admins.1.status', 'pending')     // never signed in yet
            ->assertJsonPath('data.admins.2.id', $gone->id)
            ->assertJsonPath('data.admins.2.status', 'inactive')    // deactivated goes last
            ->assertJsonMissingPath('data.admins.0.password');
    }

    public function test_a_new_admin_counts_as_pending_until_their_first_sign_in(): void
    {
        $owner = User::factory()->superAdmin()->create();
        // No last_login_at given: the database must leave it empty (migration 2026_11_20_000001)
        $new = User::factory()->admin()->create();

        $this->assertNull($new->fresh()->last_login_at);
        $this->actingAs($owner)->getJson(self::URL)
            ->assertOk()
            ->assertJsonPath('data.admins.0.status', 'pending');
    }

    public function test_needs_attention_lists_real_problems(): void
    {
        $owner = User::factory()->superAdmin()->create();
        $otherOwner = User::factory()->superAdmin()->create();

        // Backups: not set up yet
        // Failed background job
        DB::table('failed_jobs')->insert([
            'uuid' => 'job-1', 'connection' => 'database', 'queue' => 'default',
            'payload' => json_encode(['displayName' => 'App\\Jobs\\RunAnomalyCheck']), 'exception' => 'Timeout',
        ]);
        // 2 shared security alerts not reviewed yet (+1 reviewed: not counted). Shared = the same for every Super Admin.
        SecurityAlert::create(['type' => 'new_device_sign_in', 'severity' => 'medium', 'subject_email' => 'old@administrator.com']);
        SecurityAlert::create(['type' => 'failed_sign_ins', 'severity' => 'high', 'subject_email' => 'newest@administrator.com']);
        SecurityAlert::create(['type' => 'password_changed', 'severity' => 'low', 'status' => 'reviewed', 'subject_email' => 'x@administrator.com', 'reviewed_by' => $otherOwner->id]);
        // A personal notification is NOT an alert any more
        Notification::create(['recipient_id' => $owner->id, 'type' => 'security_alert', 'title' => 'Bell only', 'message' => '-']);
        // A suspended company with 2 people in it
        $north = Company::factory()->create(['name' => 'Northfield', 'is_active' => false]);
        $north->forceFill(['suspended_at' => now()->subDay()])->save();
        User::factory()->admin()->create(['company_id' => $north->id]);
        User::factory()->create()->accessibleCompanies()->attach($north->id, ['granted_status' => 'accepted']);
        User::factory()->create()->accessibleCompanies()->attach($north->id, ['granted_status' => 'pending']); // not counted

        $this->actingAs($owner)
            ->getJson(self::URL)
            ->assertOk()
            ->assertJsonCount(4, 'data.attention')
            ->assertJsonPath('data.attention.0', ['type' => 'backup_missing', 'severity' => 'danger', 'running' => false])
            ->assertJsonPath('data.attention.1.type', 'failed_jobs')
            ->assertJsonPath('data.attention.1.count', 1)
            ->assertJsonPath('data.attention.1.jobs', ['RunAnomalyCheck'])
            ->assertJsonPath('data.attention.2.type', 'security_alerts')
            ->assertJsonPath('data.attention.2.count', 2)
            ->assertJsonPath('data.attention.2.severity', 'danger') // one of them is High
            ->assertJsonPath('data.attention.2.latest', ['type' => 'failed_sign_ins', 'subject_email' => 'newest@administrator.com'])
            ->assertJsonPath('data.attention.3.type', 'company_suspended')
            ->assertJsonPath('data.attention.3.company.name', 'Northfield')
            ->assertJsonPath('data.attention.3.users_affected', 2);
    }

    public function test_services_report_what_is_really_known(): void
    {
        $owner = User::factory()->superAdmin()->create();

        // Nothing set up: no ML url, no scheduler heartbeat, no backup yet, empty queue
        config(['services.ml.url' => null]);
        $this->actingAs($owner)->getJson(self::URL)
            ->assertOk()
            ->assertJsonPath('data.services', [
                ['key' => 'ml', 'status' => 'not_configured'],
                ['key' => 'queue', 'status' => 'ok', 'failed' => 0, 'waiting' => 0],
                ['key' => 'scheduler', 'status' => 'not_configured', 'last_run_at' => null],
                ['key' => 'backup', 'status' => 'not_configured', 'last_success_at' => null, 'running' => false],
            ]);

        // ML service set up but down, scheduler stopped 10 min ago, backup 30 h old
        config(['services.ml.url' => 'http://ml.test']);
        Http::fake(['ml.test/*' => Http::response('', 500)]);
        Cache::put(SystemHealth::SCHEDULER_HEARTBEAT, now()->subMinutes(10)->toIso8601String());
        Backup::create(['status' => 'succeeded', 'trigger' => 'scheduled', 'finished_at' => now()->subHours(30)]);

        $this->actingAs($owner)->getJson(self::URL)
            ->assertOk()
            ->assertJsonPath('data.services.0.status', 'danger')
            ->assertJsonPath('data.services.2.status', 'warning')
            ->assertJsonPath('data.services.3.status', 'danger')
            ->assertJsonPath('data.attention.0.type', 'backup_overdue')
            ->assertJsonPath('data.attention.0.running', false)
            ->assertJsonPath('data.attention.1.type', 'ml_down');
    }

    public function test_global_rules_are_null_until_set_and_show_who_changed_them(): void
    {
        $owner = User::factory()->superAdmin()->create(['first_name' => 'Ana', 'last_name' => 'Cruz']);

        $this->actingAs($owner)->getJson(self::URL)
            ->assertOk()
            ->assertJsonPath('data.rules.high_value_threshold', null)
            ->assertJsonPath('data.rules.anomaly_sensitivity', null)
            ->assertJsonPath('data.rules.openai', ['monthly_cap_usd' => null, 'spent_this_month_usd' => null])
            ->assertJsonPath('data.rules.session_lifetime_minutes', (int) config('session.lifetime'))
            ->assertJsonPath('data.rules.last_change', null);

        DB::table('system_settings')->insert([
            ['key' => SystemSettings::HIGH_VALUE_THRESHOLD, 'value' => json_encode('50000.00'), 'group' => 'approval', 'updated_by' => $owner->id, 'created_at' => now(), 'updated_at' => now()->subHours(2)],
            ['key' => SystemSettings::ANOMALY_SENSITIVITY, 'value' => json_encode('balanced'), 'group' => 'ai', 'updated_by' => null, 'created_at' => now(), 'updated_at' => now()->subDays(3)],
        ]);

        $this->actingAs($owner)->getJson(self::URL)
            ->assertOk()
            ->assertJsonPath('data.rules.high_value_threshold', '50000.00')
            ->assertJsonPath('data.rules.anomaly_sensitivity', 'balanced')
            ->assertJsonPath('data.rules.last_change.by', 'Ana Cruz');
    }

    public function test_no_voucher_or_money_data_is_sent(): void
    {
        $owner = User::factory()->superAdmin()->create();

        $data = $this->actingAs($owner)->getJson(self::URL)->assertOk()->json('data');

        $this->assertSame(['checked_at', 'counts', 'services', 'attention', 'admins', 'rules'], array_keys($data));
        $this->assertStringNotContainsString('voucher', strtolower(json_encode($data)));
    }

    public function test_guests_get_401(): void
    {
        $this->getJson(self::URL)
            ->assertUnauthorized()
            ->assertJsonPath('code', 'UNAUTHENTICATED');
    }

    public function test_every_other_role_gets_403(): void
    {
        foreach (['admin', 'accounting_clerk', 'accounting_officer', 'supervisor_manager'] as $role) {
            $this->actingAs(User::factory()->create(['role' => $role]))
                ->getJson(self::URL)
                ->assertForbidden()
                ->assertJsonPath('code', 'FORBIDDEN');
        }
    }

    public function test_super_admin_cannot_open_the_admin_dashboard(): void
    {
        $this->actingAs(User::factory()->superAdmin()->create())
            ->getJson('/api/v1/admin/dashboard')
            ->assertForbidden();
    }
}
