<?php

namespace Tests\Feature\Api;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * "Retry failed jobs" (Framer fzdOvPqCX):
 *   GET /api/v1/superadmin/failed-jobs · POST /failed-jobs/retry · DELETE /failed-jobs
 *
 * Run:  php artisan test --filter=FailedJobsTest
 */
class FailedJobsTest extends TestCase
{
    use RefreshDatabase;

    private const URL = '/api/v1/superadmin/failed-jobs';

    private User $owner;

    protected function setUp(): void
    {
        parent::setUp();
        $this->owner = User::factory()->superAdmin()->create();
    }

    /** A failed job, stored exactly the way Laravel stores one. */
    private function failedJob(string $class, string $command, string $error, int $minutesAgo = 5): string
    {
        $uuid = (string) Str::uuid();
        DB::table('failed_jobs')->insert([
            'uuid' => $uuid,
            'connection' => 'database',
            'queue' => 'default',
            'payload' => json_encode([
                'uuid' => $uuid, 'displayName' => $class, 'job' => 'Illuminate\\Queue\\CallQueuedHandler@call',
                'maxTries' => 3, 'data' => ['commandName' => $class, 'command' => $command],
            ]),
            'exception' => $error,
            'failed_at' => now()->subMinutes($minutesAgo),
        ]);

        return $uuid;
    }

    private function anomalyJob(int $minutesAgo = 5): string
    {
        // a job class the catalog doesn't know (RunAnomalyCheck became a known one on 2026-11-27)
        return $this->failedJob('App\\Jobs\\RunMonthlyForecast', 'O:27:"App\\Jobs\\RunMonthlyForecast":1:{s:9:"voucherId";i:412;}',
            "RuntimeException: ML service timed out after 3 s in C:\\xampp\\htdocs\\app\\Jobs\\RunMonthlyForecast.php:40\nStack trace:\n#0 …", $minutesAgo);
    }

    private function backupJob(): string
    {
        return $this->failedJob('App\\Jobs\\RunDatabaseBackup', 'O:24:"App\\Jobs\\RunDatabaseBackup":1:{s:8:"backupId";i:17;}',
            "Illuminate\\Queue\\TimeoutExceededException: App\\Jobs\\RunDatabaseBackup has timed out. in /var/www/vendor/x.php:12\n#0 …");
    }

    public function test_it_lists_failed_jobs_in_plain_words(): void
    {
        $this->anomalyJob(10);
        $backup = $this->backupJob();

        $this->actingAs($this->owner)->getJson(self::URL)
            ->assertOk()
            ->assertJsonPath('meta.total', 2)
            ->assertJsonPath('meta.services', []) // neither listed job depends on a known service yet
            ->assertJsonPath('data.0.id', $backup)
            ->assertJsonPath('data.0.name', 'Database backup')
            ->assertJsonPath('data.0.subject', 'Backup #17')
            ->assertJsonPath('data.0.error', 'App\\Jobs\\RunDatabaseBackup has timed out.') // no server path
            ->assertJsonPath('data.0.retryable', false)
            ->assertJsonPath('data.1.name', 'Run Monthly Forecast') // unknown job: name made from the class
            ->assertJsonPath('data.1.error', 'ML service timed out after 3 s')
            ->assertJsonPath('data.1.retryable', true)
            ->assertJsonPath('data.1.max_tries', 3);
    }

    public function test_retry_puts_the_jobs_back_in_the_queue(): void
    {
        $a = $this->anomalyJob();
        $b = $this->anomalyJob();

        $this->actingAs($this->owner)->postJson(self::URL.'/retry', ['ids' => [$a, $b]])
            ->assertOk()->assertJsonPath('data.retried', 2);

        $this->assertSame(0, DB::table('failed_jobs')->count());
        $this->assertSame(2, DB::table('jobs')->count()); // waiting for the worker again
        $this->assertDatabaseHas('audit_logs', ['action' => 'failed_jobs_retried', 'user_id' => $this->owner->id]);
    }

    public function test_a_job_that_cant_be_retried_blocks_the_whole_retry(): void
    {
        $a = $this->anomalyJob();
        $backup = $this->backupJob();

        $this->actingAs($this->owner)->postJson(self::URL.'/retry', ['ids' => [$a, $backup]])
            ->assertStatus(409)->assertJsonPath('code', 'JOB_NOT_RETRYABLE');

        $this->assertSame(2, DB::table('failed_jobs')->count()); // nothing half-done
    }

    public function test_delete_removes_jobs_for_good(): void
    {
        $a = $this->anomalyJob();
        $backup = $this->backupJob();

        $this->actingAs($this->owner)->deleteJson(self::URL, ['ids' => [$backup]])
            ->assertOk()->assertJsonPath('data.deleted', 1);

        $this->assertSame([$a], DB::table('failed_jobs')->pluck('uuid')->all());
        $this->assertDatabaseHas('audit_logs', ['action' => 'failed_jobs_deleted']);
    }

    public function test_bad_or_stale_ids(): void
    {
        $a = $this->anomalyJob();

        $this->actingAs($this->owner)->postJson(self::URL.'/retry', ['ids' => []])
            ->assertStatus(422)->assertJsonValidationErrors(['ids' => 'Tick at least one job.']);
        $this->actingAs($this->owner)->postJson(self::URL.'/retry', ['ids' => [$a, 'gone-already']])
            ->assertStatus(404)->assertJsonPath('code', 'JOB_NOT_FOUND');
        $this->assertSame(1, DB::table('failed_jobs')->count());
    }

    public function test_only_super_admins_get_in(): void
    {
        $this->getJson(self::URL)->assertUnauthorized();
        $this->actingAs(User::factory()->admin()->create())->getJson(self::URL)->assertForbidden();
    }
}
