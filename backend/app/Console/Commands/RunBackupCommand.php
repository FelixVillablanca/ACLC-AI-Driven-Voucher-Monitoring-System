<?php

namespace App\Console\Commands;

use App\Domain\Platform\Backups\StartBackup;
use App\Exceptions\ApiException;
use Illuminate\Console\Command;

/**
 * php artisan backup:run
 * Starts a database backup in the background (the queue worker makes it).
 * The scheduler runs this every night at 02:00 (routes/console.php).
 */
class RunBackupCommand extends Command
{
    protected $signature = 'backup:run';

    protected $description = 'Start a database backup (made by the queue worker)';

    public function handle(StartBackup $start): int
    {
        try {
            $backup = $start->handle('scheduled');
        } catch (ApiException $e) {
            $this->warn($e->getMessage()); // e.g. one is already running

            return self::SUCCESS;
        }

        $this->info("Backup #{$backup->id} queued. The queue worker (php artisan queue:work) makes it.");

        return self::SUCCESS;
    }
}
