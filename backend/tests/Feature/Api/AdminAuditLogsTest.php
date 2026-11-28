<?php

namespace Tests\Feature\Api;

use App\Domain\Audit\AuditTrail;
use App\Models\Company;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * System → Audit logs for an Admin: only their own company, never voucher activity, read-only.
 *
 * Run:  php artisan test --filter=AdminAuditLogsTest
 */
class AdminAuditLogsTest extends TestCase
{
    use RefreshDatabase;

    private const URL = '/api/v1/admin/audit-logs';

    private Company $apex;

    private Company $north;

    private User $admin;

    private User $maria;

    protected function setUp(): void
    {
        parent::setUp();
        $this->apex = Company::factory()->create(['name' => 'Apex']);
        $this->north = Company::factory()->create(['name' => 'Northfield']);
        $this->admin = User::factory()->admin()->create(['first_name' => 'John', 'last_name' => 'Doe', 'company_id' => $this->apex->id]);
        $this->maria = User::factory()->create(['first_name' => 'Maria', 'last_name' => 'Lopez', 'company_id' => $this->apex->id]);
    }

    private function log(array $row): int
    {
        return AuditTrail::record([
            'user_id' => $this->admin->id, 'company_id' => $this->apex->id, 'table_name' => 'users', 'record_id' => $this->maria->id,
            ...$row,
        ]);
    }

    public function test_only_this_companys_entries_and_never_voucher_activity(): void
    {
        $this->log(['action' => 'role_changed', 'old_values' => ['role' => 'accounting_clerk'], 'new_values' => ['role' => 'accounting_officer']]);
        $this->log(['action' => 'department_created', 'table_name' => 'departments', 'record_id' => 5, 'new_values' => ['name' => 'Finance', 'code' => 'FIN']]);
        $this->log(['action' => 'voucher_approved', 'table_name' => 'vouchers', 'record_id' => 9, 'new_values' => ['amount' => 5000]]);
        $this->log(['action' => 'updated', 'table_name' => 'vouchers', 'record_id' => 9]); // a voucher table, any action
        $this->log(['action' => 'login', 'company_id' => $this->north->id]);
        $this->log(['action' => 'setting_changed', 'company_id' => null, 'table_name' => 'system_settings']);

        $this->actingAs($this->admin)->getJson(self::URL)
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.action.key', 'department_created')
            ->assertJsonPath('data.0.record.title', 'Finance')
            ->assertJsonPath('data.1.record.title', 'Maria Lopez')
            ->assertJsonPath('data.1.changes.0.new', 'accounting_officer')
            ->assertJsonPath('data.1.who.is_you', true)
            ->assertJsonPath('meta.summary.events_today', 2)
            ->assertJsonPath('meta.summary.sensitive_7d', 1)
            ->assertJsonMissing(['key' => 'voucher_approved']);
    }

    public function test_group_search_sensitive_and_dates(): void
    {
        $this->log(['action' => 'role_changed']);
        $this->log(['action' => 'login', 'ip_address' => '180.190.77.4']);
        $old = $this->log(['action' => 'created']);
        DB::table('audit_logs')->where('id', $old)->update(['created_at' => now()->subDays(20)]);

        $this->actingAs($this->admin)->getJson(self::URL)->assertJsonCount(2, 'data')->assertJsonPath('meta.total', 2); // last 7 days
        $this->actingAs($this->admin)->getJson(self::URL.'?from='.now()->subDays(30)->toDateString())->assertJsonCount(3, 'data');
        $this->actingAs($this->admin)->getJson(self::URL.'?group=security')->assertJsonCount(1, 'data')->assertJsonPath('data.0.action.key', 'login');
        $this->actingAs($this->admin)->getJson(self::URL.'?sensitive=1')->assertJsonCount(1, 'data')->assertJsonPath('data.0.action.key', 'role_changed');
        $this->actingAs($this->admin)->getJson(self::URL.'?search=180.190')->assertJsonCount(1, 'data');
        $this->actingAs($this->admin)->getJson(self::URL.'?group=vouchers')->assertUnprocessable();
        $this->actingAs($this->admin)->getJson(self::URL.'?to='.now()->addDay()->toDateString())->assertUnprocessable();
    }

    public function test_a_sent_company_or_actions_filter_cant_widen_the_scope(): void
    {
        $this->log(['action' => 'login', 'company_id' => $this->north->id]);
        $this->log(['action' => 'voucher_approved', 'table_name' => 'vouchers']);

        $this->actingAs($this->admin)->getJson(self::URL.'?companies[]='.$this->north->id.'&actions[]=voucher_approved&company_only='.$this->north->id)
            ->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_entry_detail_with_tamper_check_and_404_outside_the_scope(): void
    {
        $mine = $this->log(['action' => 'role_changed']);
        $theirs = $this->log(['action' => 'login', 'company_id' => $this->north->id]);
        $voucher = $this->log(['action' => 'voucher_approved', 'table_name' => 'vouchers']);

        $this->actingAs($this->admin)->getJson(self::URL."/{$mine}")->assertOk()->assertJsonPath('data.integrity', 'intact');

        DB::table('audit_logs')->where('id', $mine)->update(['new_values' => json_encode(['role' => 'admin'])]);
        $this->actingAs($this->admin)->getJson(self::URL."/{$mine}")->assertJsonPath('data.integrity', 'changed');

        $this->actingAs($this->admin)->getJson(self::URL."/{$theirs}")->assertNotFound();
        $this->actingAs($this->admin)->getJson(self::URL."/{$voucher}")->assertNotFound();
    }

    public function test_admin_without_a_company_gets_the_waiting_answer(): void
    {
        $this->log(['action' => 'role_changed']);
        $loose = User::factory()->admin()->create(['company_id' => null]);

        // since 2026-11-28: "No company yet" -> the console waits (the React app shows a waiting page)
        $this->actingAs($loose)->getJson(self::URL)->assertForbidden()->assertJsonPath('code', 'NO_COMPANY_YET');
    }

    public function test_guests_are_401_and_other_roles_403(): void
    {
        $this->getJson(self::URL)->assertUnauthorized();
        $this->maria->accessibleCompanies()->attach($this->apex->id, ['granted_status' => 'accepted']);
        $this->actingAs($this->maria)->getJson(self::URL)->assertForbidden();
    }
}
