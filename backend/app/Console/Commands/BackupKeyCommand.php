<?php

namespace App\Console\Commands;

use App\Domain\Platform\Backups\BackupCipher;
use Illuminate\Console\Command;

/**
 * php artisan backup:key
 * Prints a NEW random key for encrypted backups (Phase 7, 2026-11-28). It does not change anything by itself:
 * put the line it prints in .env (BACKUP_ENCRYPTION_KEY=…) and keep a copy outside the server.
 * Backups made with an older key need that older key to be restored.
 */
class BackupKeyCommand extends Command
{
    protected $signature = 'backup:key';

    protected $description = 'Print a new random encryption key for database backups (for BACKUP_ENCRYPTION_KEY)';

    public function handle(): int
    {
        $this->line('BACKUP_ENCRYPTION_KEY='.BackupCipher::newKey());
        $this->warn('Keep a copy outside this server (a password manager). Without it, backups made with it can\'t be restored.');

        return self::SUCCESS;
    }
}
