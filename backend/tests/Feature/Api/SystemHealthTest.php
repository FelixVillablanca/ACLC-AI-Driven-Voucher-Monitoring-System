<?php

namespace Tests\Feature\Api;

use App\Domain\Audit\AuditTrail;
use App\Domain\Platform\Health\RecordHealthChecks;
use App\Models\BlockedIp;
use App\Models\Incident;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * Super Admin System health tab (Framer m80KDanOj) + SH1 check now, SH4 jobs, SH5 job details,
 * SH7 day details, SH9 unblock with watching, SH10 incidents.
 *
 * Run:  php artisan test --filter=SystemHealthTest
 */
class SystemHealthTest extends TestCase
{
    use RefreshDatabase;

    private const URL = '/api/v1/superadmin/system-health';

    private User $owner;

    protected function setUp(): void
    {
        parent::setUp();
        config(['services.ml.url' => null, 'app.url' => 'http://app.test', 'services.health.web_url' => 'http://app.test']);
        $this->owner = User::factory()->superAdmin()->create(['first_name' => 'Felix', 'last_name' => 'V']);
    }

    private function as(string $method, string $uri = '', array $data = [])
    {
        return $this->actingAs($this->owner)->json($method, self::URL.$uri, $data);
    }

    public function test_page_shows_six_services_uptime_and_incidents(): void
    {
        $this->as('GET')->assertOk()
            ->assertJsonStructure(['data' => ['services' => ['web', 'database', 'queue', 'scheduler', 'ml', 'backup'],
                'attention', 'checked_at', 'uptime' => ['percent', 'days'], 'retrying', 'incidents']])
            ->assertJsonPath('data.services.ml.status', 'not_configured')
            ->assertJsonPath('data.uptime.percent', null) // nothing recorded yet: no made-up 99.98%
            ->assertJsonCount(30, 'data.uptime.days')
            ->assertJsonPath('data.uptime.days.29.status', 'no_data');
    }

    public function test_check_now_records_one_row_per_service(): void
    {
        // Check now can't test the web app from inside a request, so it records the other 5 and
        // never invents a web result (that used to count as a fake "ok" in the uptime %)
        $this->as('POST', '/check')->assertOk()->assertJsonPath('data.services.web.status', 'not_configured');
        $this->assertSame(5, DB::table('health_checks')->count());
        $this->assertSame(0, DB::table('health_checks')->where('service', 'web')->count());
        $this->as('GET')->assertJsonPath('data.uptime.percent', null);

        // a real scheduled check (over HTTP) is what counts
        Http::fake(['*/api/v1/health' => Http::response(['status' => 'ok'])]);
        app(RecordHealthChecks::class)->handle(fromScheduler: true);
        $this->as('GET')->assertJsonPath('data.services.web.status', 'ok')
            ->assertJsonPath('data.services.web.uptime_checks', 1)
            ->assertJsonPath('data.uptime.days.29.status', 'ok')->assertJsonPath('data.uptime.percent', 100);
    }

    public function test_three_bad_checks_in_a_row_open_an_incident_then_watching_then_resolved(): void
    {
        // the web app fails 3 times, then answers again
        Http::fake(['app.test/*' => Http::sequence()
            ->push('', 500)->push('', 500)->push('', 500)
            ->push(['status' => 'ok'])->whenEmpty(Http::response(['status' => 'ok']))]);
        $record = app(RecordHealthChecks::class);

        $record->handle();
        $record->handle();
        $this->assertSame(0, Incident::count()); // 2 bad checks: not yet
        $record->handle();

        $incident = Incident::firstOrFail();
        $this->assertSame('open', $incident->status);
        $this->assertSame('Web app & API not working', $incident->title);
        $this->assertDatabaseHas('notifications', ['recipient_id' => $this->owner->id, 'type' => 'system_alert']);

        $record->handle();
        $this->assertSame('watching', $incident->fresh()->status);

        $this->as('GET', "/incidents/{$incident->id}")->assertOk()->assertJsonPath('data.code', 'INC-001');
        $this->as('POST', "/incidents/{$incident->id}/resolve", ['note' => ''])->assertStatus(422)->assertJsonValidationErrors('note');
        $this->as('POST', "/incidents/{$incident->id}/resolve", ['note' => 'The web server was restarted.'])
            ->assertOk()->assertJsonPath('data.status', 'resolved')->assertJsonPath('data.resolved_by', 'Felix V');
        $this->as('POST', "/incidents/{$incident->id}/resolve", ['note' => 'Again please'])->assertStatus(409);
        $this->assertDatabaseHas('audit_logs', ['action' => 'incident_resolved']);

        // SH7: the day shows the unhealthy stretch
        $this->as('GET', '/days/'.now()->toDateString())->assertOk()
            ->assertJsonPath('data.stretches.0.service', 'web')
            ->assertJsonPath('data.stretches.0.status', 'danger');
        $this->as('GET', '/days/2020-01-01')->assertStatus(422);
    }

    public function test_jobs_panel_and_failed_job_details_hide_server_paths(): void
    {
        DB::table('failed_jobs')->insert([
            'uuid' => '11111111-2222-3333-4444-555555555555', 'connection' => 'database', 'queue' => 'default',
            'payload' => json_encode(['displayName' => 'App\\Jobs\\GenerateReportSummary', 'maxTries' => 3]),
            'exception' => "RuntimeException: OpenAI timed out in C:\\xampp\\htdocs\\app\\Jobs\\GenerateReportSummary.php:42\n#0 /var/www/vendor/x.php(12)",
            'failed_at' => now(),
        ]);

        $this->as('GET', '/jobs')->assertOk()->assertJsonPath('data.failed.total', 1)->assertJsonPath('data.queue.failed_last_hour', 1);

        $res = $this->as('GET', '/failed-jobs/11111111-2222-3333-4444-555555555555')->assertOk()
            ->assertJsonPath('data.name', 'Generate Report Summary');
        $this->assertStringNotContainsString('xampp', $res->getContent());
        $this->assertStringContainsString('GenerateReportSummary.php:42', $res->getContent());

        $this->as('GET', '/failed-jobs/99999999-2222-3333-4444-555555555555')->assertStatus(404);
    }

    public function test_unblock_with_watching_blocks_it_again_after_three_failures(): void
    {
        $block = BlockedIp::create(['ip_address' => '180.190.77.4', 'reason' => 'Password guessing', 'expires_at' => now()->addDays(7), 'blocked_by' => $this->owner->id]);
        AuditTrail::record(['action' => 'login_blocked', 'table_name' => 'users', 'ip_address' => '180.190.77.4']);

        $this->actingAs($this->owner)->getJson("/api/v1/superadmin/blocked-ips/{$block->id}")->assertOk()
            ->assertJsonPath('data.refused_since', 1);

        $this->actingAs($this->owner)->postJson("/api/v1/superadmin/blocked-ips/{$block->id}/unblock", ['watch' => true])
            ->assertOk()->assertJsonPath('data.unblocked_at', fn ($v) => $v !== null);

        foreach (range(1, 3) as $i) {
            $this->withServerVariables(['REMOTE_ADDR' => '180.190.77.4'])
                ->postJson('/api/v1/auth/login', ['email' => 'someone@administrator.com', 'password' => 'wrong-'.$i]);
        }

        $this->assertSame(1, BlockedIp::where('ip_address', '180.190.77.4')->active()->count());
        $this->assertDatabaseHas('notifications', ['recipient_id' => $this->owner->id, 'title' => '180.190.77.4 was blocked again']);
    }

    public function test_only_super_admins(): void
    {
        $this->getJson(self::URL)->assertStatus(401);
        $admin = User::factory()->admin()->create();
        $this->actingAs($admin)->getJson(self::URL)->assertStatus(403);
        $this->actingAs($admin)->postJson(self::URL.'/check')->assertStatus(403);
    }
}
