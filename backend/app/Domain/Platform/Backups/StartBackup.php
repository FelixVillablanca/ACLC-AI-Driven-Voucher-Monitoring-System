<?php

namespace App\Domain\Platform\Backups;

use App\Domain\Audit\AuditTrail;
use App\Exceptions\ApiException;
use App\Jobs\RunDatabaseBackup;
use App\Models\Backup;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Starts a backup: saves a "queued" row and hands the work to the background worker
 * (the RunDatabaseBackup job). Used by "Run backup now" and by the 02:00 nightly schedule.
 *
 * Only ONE backup at a time: the in-progress rows are LOCKED while we check, so two
 * clicks at the same moment can't both start one (the second gets 409).
 * A backup stuck for over 2 hours (the worker stopped or crashed) is marked failed first,
 * so it can't block every future backup.
 */
class StartBackup
{
    public function handle(string $trigger, ?User $by = null, bool $notify = false, ?string $ip = null): Backup
    {
        $backup = DB::transaction(function () use ($trigger, $by, $notify, $ip) {
            $busy = Backup::inProgress()->lockForUpdate()->get();

            $stale = now()->subMinutes((int) config('backup.stale_after_minutes'));
            foreach ($busy as $old) {
                if ($old->created_at->lt($stale)) {
                    $old->update(['status' => 'failed', 'finished_at' => now(), 'error' => 'Did not finish (the background worker stopped).']);
                }
            }

            if ($busy->contains(fn (Backup $b) => $b->status !== 'failed')) {
                throw new ApiException('A backup is already running. Wait for it to finish.', 'BACKUP_IN_PROGRESS', 409);
            }

            $backup = Backup::create([
                'status' => 'queued',
                'trigger' => $trigger,
                'requested_by' => $by?->id,
                'notify_requester' => $by !== null && $notify,
            ]);

            AuditTrail::record([
                'user_id' => $by?->id, // NULL = the nightly schedule
                'company_id' => null,  // platform-level
                'action' => 'backup_started',
                'table_name' => 'backups',
                'record_id' => $backup->id,
                'old_values' => null,
                'new_values' => json_encode(['trigger' => $trigger]),
                'ip_address' => $ip,
                'user_agent' => null,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            return $backup;
        });

        // Only after the row is safely saved (afterCommit), so the worker always finds it
        RunDatabaseBackup::dispatch($backup->id)->afterCommit();

        return $backup;
    }
}
