<?php

namespace App\Http\Controllers\Api\V1\SuperAdmin;

use App\Domain\Platform\Backups\DumpDatabase;
use App\Domain\Platform\Backups\StartBackup;
use App\Domain\Platform\SystemHealth;
use App\Http\Controllers\Controller;
use App\Http\Requests\SuperAdmin\StartBackupRequest;
use App\Http\Resources\BackupResource;
use App\Models\Backup;
use Illuminate\Http\JsonResponse;

/**
 * Database backups (Framer TKziMjHUe "Run a database backup now?").
 */
class BackupController extends Controller
{
    /** If nothing is known about speed yet, assume mysqldump + gzip manage about 20 MB per second. */
    private const BYTES_PER_SECOND_GUESS = 20 * 1024 * 1024;

    /**
     * GET /api/v1/superadmin/backups/overview
     * Everything the confirm dialog shows: last good backup, database size, estimated time,
     * where it's saved, the nightly time, and the backup in progress (if any).
     */
    public function overview(): JsonResponse
    {
        $last = Backup::succeeded()->latest('finished_at')->latest('id')->first();
        $current = Backup::inProgress()->with('requester:id,first_name,last_name')->latest('id')->first();
        $latestFailed = Backup::where('status', 'failed')->latest('id')->first();
        $databaseSize = DumpDatabase::databaseSizeBytes();

        return response()->json(['data' => [
            'last_success' => $last ? [
                'finished_at' => $last->finished_at->toIso8601String(),
                'size_bytes' => $last->size_bytes,
            ] : null,
            'overdue_after_hours' => SystemHealth::BACKUP_OVERDUE_AFTER_HOURS,
            // Did the newest attempt fail? ("The last nightly backup did not run")
            'last_attempt_failed' => $latestFailed !== null && ($last === null || $latestFailed->id > $last->id),
            'database_size_bytes' => $databaseSize,
            'estimated_seconds' => $this->estimate($last, $databaseSize),
            'destination' => config('backup.destination'),
            'nightly_at' => config('backup.nightly_at'),
            'keep' => (int) config('backup.keep'),
            'current' => $current ? BackupResource::make($current) : null,
        ]]);
    }

    /** POST /api/v1/superadmin/backups  -> 202 Accepted (it runs in the background) */
    public function store(StartBackupRequest $request, StartBackup $start): JsonResponse
    {
        $backup = $start->handle('manual', $request->user(), $request->boolean('notify'), $request->ip());

        return BackupResource::make($backup->load('requester:id,first_name,last_name'))->response()->setStatusCode(202);
    }

    /** GET /api/v1/superadmin/backups/{backup}  (the dialog asks every few seconds until it's done) */
    public function show(Backup $backup): BackupResource
    {
        return BackupResource::make($backup->load('requester:id,first_name,last_name'));
    }

    /** Last good backup's speed, scaled to today's size; otherwise a rough guess. At least 5 s. */
    private function estimate(?Backup $last, int $databaseSize): int
    {
        $seconds = $last?->durationSeconds();
        if ($seconds && $last->database_size_bytes) {
            return max(5, (int) round($seconds * $databaseSize / $last->database_size_bytes));
        }

        return max(5, (int) ceil($databaseSize / self::BYTES_PER_SECOND_GUESS));
    }
}
