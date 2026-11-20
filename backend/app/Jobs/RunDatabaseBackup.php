<?php

namespace App\Jobs;

use App\Domain\Platform\Backups\DumpDatabase;
use App\Models\Backup;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Number;
use Throwable;

/**
 * QUEUED JOB: makes the backup in the background (the `php artisan queue:work` process),
 * so nobody's browser has to wait for it.
 *
 *   queued -> running -> succeeded (file saved, old files pruned) | failed (reason kept)
 *
 * Who hears about it:
 *   - the Super Admin who ticked "Notify me when it finishes" (success or failure)
 *   - EVERY Super Admin when a nightly backup fails (nobody was watching it)
 */
class RunDatabaseBackup implements ShouldQueue
{
    use Queueable;

    /** One try: a half-made backup is retried by clicking again, not automatically. */
    public int $tries = 1;

    public int $timeout;

    public function __construct(public int $backupId)
    {
        $this->timeout = (int) config('backup.timeout_seconds') + 60;
    }

    public function handle(DumpDatabase $dump): void
    {
        $backup = Backup::find($this->backupId);
        if (! $backup || $backup->status !== 'queued') {
            return; // already handled (or marked stale)
        }

        $backup->update(['status' => 'running', 'started_at' => now(), 'database_size_bytes' => DumpDatabase::databaseSizeBytes()]);

        try {
            $file = $dump->handle('advms-'.now()->format('Y-m-d-His').'-'.$backup->id);
        } catch (Throwable $e) {
            $this->failed($e); // record it ourselves; the backup row is the source of truth

            return;
        }

        $backup->update([
            'status' => 'succeeded',
            'finished_at' => now(),
            'file_path' => $file['path'],
            'size_bytes' => $file['size_bytes'],
        ]);

        $this->prune();

        if ($backup->notify_requester && $backup->requested_by) {
            $this->tell([$backup->requested_by], 'Backup finished',
                'The database backup finished in '.$this->took($backup).' ('.Number::fileSize($file['size_bytes'], 1).').');
        }
    }

    /** Laravel calls this when the job fails (an error above, a timeout, or the worker giving up). */
    public function failed(?Throwable $e): void
    {
        $backup = Backup::find($this->backupId);
        if (! $backup || in_array($backup->status, ['succeeded', 'failed'], true)) {
            return;
        }

        Log::error('Database backup failed', ['backup_id' => $backup->id, 'error' => $e?->getMessage()]);

        $backup->update([
            'status' => 'failed',
            'finished_at' => now(),
            // Kept short and free of passwords: mysqldump never sees the password on its command line
            'error' => mb_substr($e?->getMessage() ?? 'Unknown error', 0, 1000),
        ]);

        $recipients = $backup->trigger === 'scheduled'
            ? User::where('role', 'super_admin')->where('is_active', true)->pluck('id')->all()
            : ($backup->notify_requester && $backup->requested_by ? [$backup->requested_by] : []);

        $this->tell($recipients, 'Backup failed',
            ($backup->trigger === 'scheduled' ? 'Last night’s backup' : 'The database backup').' did not finish. Open the dashboard and try “Run backup now”.');
    }

    /** Keep the newest good backups (config backup.keep); delete older files and mark them so. */
    private function prune(): void
    {
        $old = Backup::succeeded()->whereNotNull('file_path')->orderByDesc('finished_at')->orderByDesc('id')
            ->get()->slice((int) config('backup.keep'));

        foreach ($old as $backup) {
            Storage::disk('local')->delete($backup->file_path);
            $backup->update(['file_path' => null]); // the row stays as history
        }
    }

    private function took(Backup $backup): string
    {
        $seconds = $backup->durationSeconds() ?? 0;

        return $seconds < 60 ? $seconds.' s' : ceil($seconds / 60).' min';
    }

    /** @param  array<int, int>  $userIds */
    private function tell(array $userIds, string $title, string $message): void
    {
        foreach ($userIds as $id) {
            Notification::create(['recipient_id' => $id, 'type' => 'system_alert', 'title' => $title, 'message' => $message]);
        }
    }
}
