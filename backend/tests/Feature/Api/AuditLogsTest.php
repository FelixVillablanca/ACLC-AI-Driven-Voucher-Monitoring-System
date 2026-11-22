<?php

namespace Tests\Feature\Api;

use App\Domain\Audit\AuditTrail;
use App\Mail\SignInAttemptsMail;
use App\Models\BlockedIp;
use App\Models\Company;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

/**
 * Super Admin Audit logs tab (Framer EJ0asP2ZH) + AL1 export, AL2 IP search, AL3/AL4 facets,
 * AL6 sensitive only, AL7 event details (tamper check), AL8 block IP.
 *
 * Run:  php artisan test --filter=AuditLogsTest
 */
class AuditLogsTest extends TestCase
{
    use RefreshDatabase;

    private const URL = '/api/v1/superadmin/audit-logs';

    private User $owner;

    private Company $apex;

    private User $maria;

    protected function setUp(): void
    {
        parent::setUp();
        Mail::fake();
        $this->owner = User::factory()->superAdmin()->create(['first_name' => 'Felix', 'last_name' => 'V']);
        $this->apex = Company::factory()->create(['name' => 'Apex Holdings Inc.']);
        $this->maria = User::factory()->create(['first_name' => 'Maria', 'last_name' => 'Lopez', 'company_id' => $this->apex->id]);

        AuditTrail::record(['user_id' => $this->owner->id, 'company_id' => $this->apex->id, 'action' => 'role_changed',
            'table_name' => 'users', 'record_id' => $this->maria->id,
            'old_values' => ['role' => 'accounting_clerk', 'amount' => '999.00'], 'new_values' => ['role' => 'accounting_officer'],
            'ip_address' => '112.204.18.7']);
        AuditTrail::record(['action' => 'login_failed', 'table_name' => 'users',
            'new_values' => ['email' => 'nobody@administrator.com', 'reason' => 'unknown_email'], 'ip_address' => '180.190.77.4']);
        AuditTrail::record(['user_id' => $this->maria->id, 'company_id' => $this->apex->id, 'action' => 'login',
            'table_name' => 'users', 'record_id' => $this->maria->id, 'new_values' => ['device' => 'Chrome on Windows'], 'ip_address' => '112.204.18.7']);
    }

    private function as(string $method, string $uri = '', array $data = [], ?User $user = null)
    {
        return $this->actingAs($user ?? $this->owner)->json($method, self::URL.$uri, $data);
    }

    public function test_lists_today_newest_first_with_who_record_and_hidden_money(): void
    {
        $res = $this->as('GET')->assertOk()
            ->assertJsonPath('meta.total', 3)
            ->assertJsonPath('meta.summary.events_today', 3)
            ->assertJsonPath('meta.summary.failed_sign_ins_24h', 1)
            ->assertJsonPath('data.0.action.key', 'login')
            ->assertJsonPath('data.1.who.kind', 'unknown')
            ->assertJsonPath('data.1.record.subtitle', 'No such account');

        $role = collect($res->json('data'))->firstWhere('action.key', 'role_changed');
        $this->assertSame('Maria Lopez', $role['record']['title']);
        $this->assertTrue($role['action']['sensitive']);
        $this->assertTrue($role['who']['is_you']);
        $this->assertContains(['field' => 'amount', 'old' => '(hidden)', 'new' => null], $role['changes']);
        $this->assertStringNotContainsString('999.00', $res->getContent());
    }

    public function test_filters_search_company_action_sensitive_and_facets(): void
    {
        $this->as('GET', '?search=maria')->assertOk()->assertJsonPath('meta.total', 2);
        $this->as('GET', '?search=180.190.77.4')->assertOk()->assertJsonPath('meta.total', 1)
            ->assertJsonPath('meta.ip.failed_sign_ins', 1)
            ->assertJsonPath('meta.ip.accounts_tried.0.exists', false);
        $this->as('GET', '?companies[]=platform')->assertOk()->assertJsonPath('meta.total', 1);
        $this->as('GET', '?actions[]=login')->assertOk()->assertJsonPath('meta.total', 1)
            ->assertJsonPath('meta.facets.groups.security', 2) // facets ignore their own filter
            ->assertJsonPath('meta.facets.companies.'.$this->apex->id, 1);
        $this->as('GET', '?sensitive=1')->assertOk()->assertJsonPath('meta.total', 2);
        $this->as('GET', '?from=2020-01-01&to=2020-01-02')->assertOk()->assertJsonPath('meta.total', 0);
    }

    public function test_event_details_show_the_tamper_check(): void
    {
        $id = DB::table('audit_logs')->where('action', 'role_changed')->value('id');
        $this->as('GET', "/{$id}")->assertOk()->assertJsonPath('data.integrity', 'intact');

        // someone edits the row straight in the database: the fingerprint no longer matches
        DB::table('audit_logs')->where('id', $id)->update(['new_values' => json_encode(['role' => 'super_admin'])]);
        $this->as('GET', "/{$id}")->assertOk()->assertJsonPath('data.integrity', 'changed');

        $this->as('GET', '/999999')->assertStatus(404);
    }

    public function test_export_csv_is_audited_and_hides_money(): void
    {
        $csv = $this->actingAs($this->owner)->get(self::URL.'/export?'.http_build_query([
            'from' => now()->toDateString(), 'events' => 'all', 'include' => ['values', 'request'],
        ]))->assertOk()->assertHeader('Content-Type', 'text/csv; charset=UTF-8')->getContent();

        $this->assertStringContainsString('User role changed', $csv);
        $this->assertStringNotContainsString('999.00', $csv);
        $this->assertDatabaseHas('audit_logs', ['action' => 'audit_exported', 'user_id' => $this->owner->id]);
    }

    public function test_block_an_ip_refuses_its_sign_ins_and_emails_the_accounts_tried(): void
    {
        $admin = User::factory()->admin()->create(['company_id' => $this->apex->id, 'personal_email' => 'liza@gmail.com']);
        AuditTrail::record(['action' => 'login_failed', 'table_name' => 'users', 'user_id' => null,
            'new_values' => ['email' => strtolower($admin->email), 'reason' => 'wrong_password'], 'ip_address' => '180.190.77.4']);

        $this->actingAs($this->owner)->postJson('/api/v1/superadmin/blocked-ips', [
            'ip_address' => '180.190.77.4', 'duration' => '7d', 'reason' => 'Repeated failed sign-ins', 'notify_accounts' => true,
        ])->assertCreated()->assertJsonPath('meta.accounts_emailed', 1);

        Mail::assertSent(SignInAttemptsMail::class, fn ($m) => $m->hasTo('liza@gmail.com'));
        $this->assertDatabaseHas('audit_logs', ['action' => 'ip_blocked']);

        // a sign-in from that address is refused (even with the right password) and logged
        $this->withServerVariables(['REMOTE_ADDR' => '180.190.77.4'])
            ->postJson('/api/v1/auth/login', ['email' => $admin->email, 'password' => 'password'])
            ->assertStatus(403)->assertJsonPath('code', 'IP_BLOCKED');
        $this->assertDatabaseHas('audit_logs', ['action' => 'login_blocked', 'ip_address' => '180.190.77.4']);

        // back to the Super Admin's own address for the rest of the test
        $this->withServerVariables(['REMOTE_ADDR' => '127.0.0.1']);

        // twice = 409; unblock lets it in again
        $this->actingAs($this->owner)->postJson('/api/v1/superadmin/blocked-ips', [
            'ip_address' => '180.190.77.4', 'duration' => '24h', 'reason' => 'Again please',
        ])->assertStatus(409)->assertJsonPath('code', 'IP_ALREADY_BLOCKED');

        $block = BlockedIp::first();
        $this->actingAs($this->owner)->postJson("/api/v1/superadmin/blocked-ips/{$block->id}/unblock")->assertOk();
        $this->actingAs($this->owner)->postJson("/api/v1/superadmin/blocked-ips/{$block->id}/unblock")->assertStatus(409);
    }

    public function test_block_validation_and_you_cant_block_yourself(): void
    {
        $this->actingAs($this->owner)->postJson('/api/v1/superadmin/blocked-ips', ['ip_address' => 'not-an-ip', 'duration' => '1y', 'reason' => ''])
            ->assertStatus(422)->assertJsonValidationErrors(['ip_address', 'duration', 'reason']);

        $this->actingAs($this->owner)->withServerVariables(['REMOTE_ADDR' => '10.0.0.5'])
            ->postJson('/api/v1/superadmin/blocked-ips', ['ip_address' => '10.0.0.5', 'duration' => '24h', 'reason' => 'Testing it'])
            ->assertStatus(422)->assertJsonPath('code', 'IP_IS_YOURS');
    }

    public function test_bad_filters_are_422_and_only_super_admins(): void
    {
        $this->getJson(self::URL)->assertStatus(401); // first, before anyone is signed in

        $this->as('GET', '?from=2026-13-40')->assertStatus(422);
        $this->as('GET', '?to='.now()->addDays(3)->toDateString())->assertStatus(422);
        $this->as('GET', '?companies[]=drop table')->assertStatus(422);

        $this->as('GET', '', [], $this->maria)->assertStatus(403);
        $this->actingAs($this->maria)->postJson('/api/v1/superadmin/blocked-ips', [])->assertStatus(403);
    }
}
