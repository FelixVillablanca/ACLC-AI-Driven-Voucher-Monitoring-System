<?php

namespace Tests\Feature\Api;

use App\Domain\Platform\Backups\DumpDatabase;
use App\Jobs\RunDatabaseBackup;
use App\Models\Backup;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Process;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use RuntimeException;
use Tests\TestCase;

/**
 * "Run a database backup now?" (Framer TKziMjHUe) + the nightly backup.
 *   GET /api/v1/superadmin/backups/overview · POST /backups · GET /backups/{id} · php artisan backup:run
 *
 * The queue is "sync" in tests, so the job runs straight away inside the request.
 * Run:  php artisan test --filter=DatabaseBackupTest
 */
class DatabaseBackupTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
        $this->owner = User::factory()->superAdmin()->create(['first_name' => 'Felix', 'last_name' => 'V']);
    }

    /** Replace the real mysqldump with a quick fake that writes a tiny file. */
    private function fakeDump(?string $failWith = null): void
    {
        $this->app->instance(DumpDatabase::class, new class($failWith) extends DumpDatabase
        {
            public function __construct(private ?string $failWith) {}

            public function handle(string $fileName): array
            {
                if ($this->failWith) {
                    throw new RuntimeException($this->failWith);
                }
                Storage::disk('local')->put("backups/{$fileName}.sql.gz", 'fake');

                return ['path' => "backups/{$fileName}.sql.gz", 'size_bytes' => 4];
            }
        });
    }

    public function test_the_overview_before_any_backup(): void
    {
        $this->actingAs($this->owner)->getJson('/api/v1/superadmin/backups/overview')
            ->assertOk()
            ->assertJsonPath('data.last_success', null)
            ->assertJsonPath('data.last_attempt_failed', false)
            ->assertJsonPath('data.destination', 'local')
            ->assertJsonPath('data.nightly_at', '02:00')
            ->assertJsonPath('data.current', null)
            ->assertJsonPath('data.estimated_seconds', fn ($s) => $s >= 5)
            ->assertJsonPath('data.database_size_bytes', fn ($b) => $b > 0);
    }

    public function test_run_backup_now_makes_a_backup_and_notifies_when_asked(): void
    {
        $this->fakeDump();

        $id = $this->actingAs($this->owner)->postJson('/api/v1/superadmin/backups', ['notify' => true])
            ->assertStatus(202)
            ->assertJsonPath('data.trigger', 'manual')
            ->assertJsonPath('data.requested_by.full_name', 'Felix V')
            ->json('data.id');

        $backup = Backup::findOrFail($id);
        $this->assertSame('succeeded', $backup->status);
        $this->assertSame(4, $backup->size_bytes);
        Storage::disk('local')->assertExists($backup->file_path);
        $this->assertDatabaseHas('notifications', ['recipient_id' => $this->owner->id, 'type' => 'system_alert', 'title' => 'Backup finished']);
        $this->assertDatabaseHas('audit_logs', ['action' => 'backup_started', 'record_id' => $id, 'user_id' => $this->owner->id]);

        $this->actingAs($this->owner)->getJson("/api/v1/superadmin/backups/{$id}")
            ->assertOk()->assertJsonPath('data.status', 'succeeded')->assertJsonMissingPath('data.file_path');

        // The dashboard sees it: the backup service is green, nothing "missing" any more
        $this->actingAs($this->owner)->getJson('/api/v1/superadmin/dashboard')
            ->assertJsonPath('data.services.3.status', 'ok')
            ->assertJsonPath('data.services.3.running', false);
    }

    public function test_no_notification_unless_ticked(): void
    {
        $this->fakeDump();
        $this->actingAs($this->owner)->postJson('/api/v1/superadmin/backups')->assertStatus(202);

        $this->assertSame(0, Notification::count());
    }

    public function test_only_one_backup_at_a_time_and_a_stuck_one_is_cleared(): void
    {
        Queue::fake(); // nothing runs: the first backup stays "queued"

        $this->actingAs($this->owner)->postJson('/api/v1/superadmin/backups')->assertStatus(202);
        $this->actingAs($this->owner)->postJson('/api/v1/superadmin/backups')
            ->assertStatus(409)->assertJsonPath('code', 'BACKUP_IN_PROGRESS');
        Queue::assertPushed(RunDatabaseBackup::class, 1);

        $this->actingAs($this->owner)->getJson('/api/v1/superadmin/backups/overview')
            ->assertJsonPath('data.current.status', 'queued');

        // 3 hours later the worker never picked it up: it counts as dead, and a new one may start
        $this->travel(3)->hours();
        $this->actingAs($this->owner)->postJson('/api/v1/superadmin/backups')->assertStatus(202);
        $this->assertSame(1, Backup::where('status', 'failed')->count());
    }

    public function test_a_failed_backup_is_recorded_and_the_requester_is_told(): void
    {
        $this->fakeDump('mysqldump: Got error: 2002');

        $id = $this->actingAs($this->owner)->postJson('/api/v1/superadmin/backups', ['notify' => true])->assertStatus(202)->json('data.id');

        $this->actingAs($this->owner)->getJson("/api/v1/superadmin/backups/{$id}")
            ->assertJsonPath('data.status', 'failed')
            ->assertJsonPath('data.error', 'mysqldump: Got error: 2002');
        $this->assertDatabaseHas('notifications', ['recipient_id' => $this->owner->id, 'title' => 'Backup failed']);
        $this->actingAs($this->owner)->getJson('/api/v1/superadmin/backups/overview')->assertJsonPath('data.last_attempt_failed', true);
    }

    public function test_the_nightly_backup_command_and_its_failure_alert_every_super_admin(): void
    {
        $other = User::factory()->superAdmin()->create();
        $this->fakeDump('disk full');

        $this->artisan('backup:run')->assertSuccessful();

        $this->assertSame('scheduled', Backup::sole()->trigger);
        $this->assertNull(Backup::sole()->requested_by);
        $this->assertSame(2, Notification::where('title', 'Backup failed')->count()); // both Super Admins
        $this->assertDatabaseHas('notifications', ['recipient_id' => $other->id, 'type' => 'system_alert']);
    }

    public function test_only_the_newest_7_good_backups_keep_their_file(): void
    {
        $this->fakeDump();
        for ($i = 0; $i < 9; $i++) {
            $this->travel(1)->days();
            $this->actingAs($this->owner)->postJson('/api/v1/superadmin/backups')->assertStatus(202);
        }

        $this->assertSame(9, Backup::succeeded()->count());
        $this->assertSame(7, Backup::succeeded()->whereNotNull('file_path')->count());
        $this->assertCount(7, Storage::disk('local')->files('backups'));
    }

    public function test_the_real_mysqldump_makes_a_gzip_file(): void
    {
        $dump = app(DumpDatabase::class)->handle('real-check');

        $sql = gzdecode(Storage::disk('local')->get($dump['path']));
        $this->assertStringContainsString('CREATE TABLE `backups`', $sql);
        $this->assertGreaterThan(0, $dump['size_bytes']);
        $this->assertFileDoesNotExist(Storage::disk('local')->path('backups/real-check.sql.tmp'));
    }

    public function test_the_password_never_goes_on_the_command_line(): void
    {
        Process::fake(['*' => Process::result(errorOutput: 'Access denied', exitCode: 2)]);
        config(['database.connections.mysql.password' => 's3cret-pw']);

        try {
            app(DumpDatabase::class)->handle('pw-check');
            $this->fail('It should have failed');
        } catch (RuntimeException $e) {
            $this->assertStringContainsString('Access denied', $e->getMessage());
        }

        Process::assertRan(fn ($process) => ! str_contains(implode(' ', (array) $process->command), 's3cret-pw')
            && ($process->environment['MYSQL_PWD'] ?? null) === 's3cret-pw');
    }

    public function test_only_super_admins_get_in(): void
    {
        $this->getJson('/api/v1/superadmin/backups/overview')->assertUnauthorized();
        $this->actingAs(User::factory()->admin()->create())->postJson('/api/v1/superadmin/backups')->assertForbidden();
        $this->actingAs($this->owner)->getJson('/api/v1/superadmin/backups/999')->assertNotFound();
    }
}
