<?php

namespace Tests\Feature\Api;

use App\Domain\Platform\SystemSettings;
use App\Http\Middleware\EnforceIdleTimeout;
use App\Models\Company;
use App\Models\User;
use Database\Seeders\SystemSettingsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Account rules added 2026-11-20:
 *   - suspended companies block sign-in and end sessions that are already open (Framer eGUijf8Wd)
 *   - deactivated accounts are signed out on their next request
 *   - Super Admins: 15-minute idle timeout, no "keep me signed in", 60 requests/minute
 *   - SystemSettingsSeeder writes the platform defaults once
 *
 * Run:  php artisan test --filter=AccountSecurityTest
 */
class AccountSecurityTest extends TestCase
{
    use RefreshDatabase;

    private function login(string $email, bool $remember = false)
    {
        return $this->withHeader('Referer', 'http://localhost:5173')
            ->postJson('/api/v1/auth/login', ['email' => $email, 'password' => 'password', 'remember' => $remember]);
    }

    private function clerkIn(Company ...$companies): User
    {
        $clerk = User::factory()->create(['email' => 'clerk@example.test', 'company_id' => $companies[0]->id]);
        foreach ($companies as $company) {
            $clerk->accessibleCompanies()->attach($company->id, ['granted_status' => 'accepted']);
        }

        return $clerk;
    }

    private function suspend(Company $company): void
    {
        $company->forceFill(['is_active' => false, 'suspended_at' => now(), 'suspension_reason' => 'Unpaid'])->save();
    }

    // ---- Suspended companies (#5) ------------------------------------------------------------

    public function test_a_clerk_whose_only_company_is_suspended_cannot_sign_in(): void
    {
        $apex = Company::factory()->create();
        $this->clerkIn($apex);
        $this->suspend($apex);

        $this->login('clerk@example.test')
            ->assertForbidden()
            ->assertJsonPath('code', 'COMPANY_SUSPENDED');

        $this->assertGuest('web'); // no session was started, not even for a moment
    }

    public function test_a_clerk_with_another_active_company_signs_in_and_only_sees_that_one(): void
    {
        $apex = Company::factory()->create(['name' => 'Apex']);
        $north = Company::factory()->create(['name' => 'Northfield']);
        $this->clerkIn($apex, $north);
        $this->suspend($apex);

        $this->login('clerk@example.test')
            ->assertOk()
            ->assertJsonCount(1, 'data.companies')
            ->assertJsonPath('data.companies.0.name', 'Northfield');
    }

    public function test_an_open_session_is_ended_on_the_next_request_after_a_suspension(): void
    {
        $apex = Company::factory()->create();
        $clerk = $this->clerkIn($apex);

        $this->actingAs($clerk)->getJson('/api/v1/auth/me')->assertOk();

        $this->suspend($apex);

        $this->actingAs($clerk)->getJson('/api/v1/auth/me')
            ->assertForbidden()
            ->assertJsonPath('code', 'COMPANY_SUSPENDED');
    }

    public function test_a_companys_admin_is_blocked_when_it_is_suspended(): void
    {
        $apex = Company::factory()->create();
        $admin = User::factory()->admin()->create(['email' => 'admin@example.test', 'company_id' => $apex->id]);
        $this->login('admin@example.test')->assertOk();

        $this->suspend($apex);

        $this->actingAs($admin)->getJson('/api/v1/admin/dashboard')
            ->assertForbidden()->assertJsonPath('code', 'COMPANY_SUSPENDED');
        $this->login('admin@example.test')
            ->assertForbidden()->assertJsonPath('code', 'COMPANY_SUSPENDED');
    }

    public function test_super_admins_are_never_blocked_by_a_suspension(): void
    {
        $apex = Company::factory()->create();
        $this->suspend($apex);
        User::factory()->superAdmin()->create(['email' => 'owner@Superadmin.com', 'company_id' => $apex->id]);

        $this->login('owner@Superadmin.com')->assertOk();
    }

    public function test_a_deactivated_user_is_signed_out_on_the_next_request(): void
    {
        $apex = Company::factory()->create();
        $clerk = $this->clerkIn($apex);
        $this->actingAs($clerk)->getJson('/api/v1/auth/me')->assertOk();

        $clerk->forceFill(['is_active' => false, 'deactivated_at' => now()])->save();

        $this->actingAs($clerk)->getJson('/api/v1/auth/me')
            ->assertForbidden()
            ->assertJsonPath('code', 'ACCOUNT_INACTIVE');
    }

    // ---- Super Admin session rules (#6) ------------------------------------------------------

    public function test_keep_me_signed_in_is_ignored_for_super_admins(): void
    {
        User::factory()->superAdmin()->create(['email' => 'owner@Superadmin.com']);

        $response = $this->login('owner@Superadmin.com', remember: true)->assertOk();

        $rememberCookie = collect($response->headers->getCookies())
            ->first(fn ($cookie) => str_starts_with($cookie->getName(), 'remember_web_'));
        $this->assertNull($rememberCookie, 'Super Admins must not get a 30-day remember cookie.');
    }

    public function test_a_super_admin_idle_for_too_long_is_signed_out(): void
    {
        $owner = User::factory()->superAdmin()->create();

        $this->actingAs($owner)
            ->withHeader('Referer', 'http://localhost:5173') // a request from the React app (it has a session)
            ->withSession([EnforceIdleTimeout::SESSION_KEY => now()->subMinutes(16)->timestamp])
            ->getJson('/api/v1/superadmin/dashboard')
            ->assertUnauthorized()
            ->assertJsonPath('code', 'SESSION_EXPIRED')
            ->assertJsonPath('message', 'You were signed out after 15 minutes without activity. Please sign in again.');
    }

    public function test_the_idle_limit_comes_from_global_settings(): void
    {
        $owner = User::factory()->superAdmin()->create();
        DB::table('system_settings')->insert([
            'key' => SystemSettings::SUPER_ADMIN_IDLE_TIMEOUT, 'value' => json_encode(30), 'group' => 'security',
        ]);

        $this->actingAs($owner)
            ->withHeader('Referer', 'http://localhost:5173') // a request from the React app (it has a session)
            ->withSession([EnforceIdleTimeout::SESSION_KEY => now()->subMinutes(16)->timestamp])
            ->getJson('/api/v1/superadmin/dashboard')
            ->assertOk(); // 16 idle minutes is fine when the limit is 30
    }

    public function test_background_refreshes_do_not_count_as_activity(): void
    {
        $owner = User::factory()->superAdmin()->create();
        $tenMinutesAgo = now()->subMinutes(10)->timestamp;

        $this->actingAs($owner)
            ->withHeader('Referer', 'http://localhost:5173') // a request from the React app (it has a session)
            ->withSession([EnforceIdleTimeout::SESSION_KEY => $tenMinutesAgo])
            ->withHeader(EnforceIdleTimeout::BACKGROUND_HEADER, '1')
            ->getJson('/api/v1/superadmin/dashboard')
            ->assertOk()
            ->assertSessionHas(EnforceIdleTimeout::SESSION_KEY, $tenMinutesAgo); // clock NOT reset

        $this->flushHeaders(); // headers stay on later requests in a test; start the "real click" clean

        $this->actingAs($owner)
            ->withHeader('Referer', 'http://localhost:5173') // a request from the React app (it has a session)
            ->withSession([EnforceIdleTimeout::SESSION_KEY => $tenMinutesAgo])
            ->getJson('/api/v1/superadmin/dashboard')
            ->assertOk()
            ->assertSessionHas(EnforceIdleTimeout::SESSION_KEY, now()->timestamp); // a real click resets it
    }

    public function test_other_roles_have_no_15_minute_idle_limit(): void
    {
        $admin = User::factory()->admin()->create();

        $this->actingAs($admin)
            ->withHeader('Referer', 'http://localhost:5173') // a request from the React app (it has a session)
            ->withSession([EnforceIdleTimeout::SESSION_KEY => now()->subMinutes(60)->timestamp])
            ->getJson('/api/v1/admin/dashboard')
            ->assertOk();
    }

    public function test_the_super_admin_area_allows_60_requests_a_minute(): void
    {
        $owner = User::factory()->superAdmin()->create();

        for ($i = 0; $i < 60; $i++) {
            $this->actingAs($owner)->getJson('/api/v1/superadmin/dashboard')->assertOk();
        }

        $this->actingAs($owner)->getJson('/api/v1/superadmin/dashboard')
            ->assertStatus(429)
            ->assertJsonPath('code', 'TOO_MANY_REQUESTS');
    }

    // ---- Platform defaults (#4) --------------------------------------------------------------

    public function test_the_settings_seeder_adds_defaults_once_and_never_overwrites(): void
    {
        DB::table('system_settings')->insert([
            'key' => SystemSettings::HIGH_VALUE_THRESHOLD, 'value' => json_encode('80000.00'), 'group' => 'approval',
        ]);

        $this->seed(SystemSettingsSeeder::class);
        $this->seed(SystemSettingsSeeder::class); // second run: nothing new

        $this->assertSame(count(SystemSettings::DEFAULTS), DB::table('system_settings')->count());
        $this->assertSame('"80000.00"', DB::table('system_settings')->where('key', SystemSettings::HIGH_VALUE_THRESHOLD)->value('value'));
        $this->assertSame('"balanced"', DB::table('system_settings')->where('key', SystemSettings::ANOMALY_SENSITIVITY)->value('value'));
        $this->assertSame(1, DB::table('audit_logs')->where('action', 'defaults_applied')->whereNull('user_id')->count());
    }

    // ---- Deactivated date on the Super Admin dashboard (#3) ----------------------------------

    public function test_the_dashboard_sends_when_an_admin_was_deactivated(): void
    {
        $owner = User::factory()->superAdmin()->create();
        User::factory()->admin()->inactive()->create(['deactivated_at' => '2026-11-10 09:00:00']);

        $this->actingAs($owner)->getJson('/api/v1/superadmin/dashboard')
            ->assertOk()
            ->assertJsonPath('data.admins.0.status', 'inactive')
            ->assertJsonPath('data.admins.0.deactivated_at', '2026-11-10T09:00:00+08:00')
            ->assertJsonPath('data.rules.super_admin_idle_timeout_minutes', 15);
    }
}
