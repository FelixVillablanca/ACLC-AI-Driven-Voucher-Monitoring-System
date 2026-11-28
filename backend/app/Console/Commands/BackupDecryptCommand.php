<?php

namespace App\Console\Commands;

use App\Domain\Platform\Backups\BackupCipher;
use Illuminate\Console\Command;
use Throwable;

/**
 * php artisan backup:decrypt storage/app/private/backups/advms-2026-11-28-020000.sql.gz.enc [--out=restore.sql.gz]
 * Turns an encrypted backup back into the .sql.gz that mysqldump made (Phase 7, 2026-11-28), using
 * BACKUP_ENCRYPTION_KEY (or the key derived from APP_KEY). A changed or cut-short file is refused, and nothing is
 * written then. Restore the result with:  gunzip -c restore.sql.gz | mysql -u root <database>
 */
class BackupDecryptCommand extends Command
{
    protected $signature = 'backup:decrypt {file : the .sql.gz.enc backup} {--out= : where to write the .sql.gz (default: next to it)}';

    protected $description = 'Decrypt an encrypted database backup back into its .sql.gz';

    public function handle(): int
    {
        $from = (string) $this->argument('file');
        if (! is_file($from)) {
            $this->error("No such file: {$from}");

            return self::FAILURE;
        }
        $to = (string) ($this->option('out') ?: preg_replace('/\.enc$/', '', $from));
        if ($to === $from) {
            $to .= '.decrypted';
        }
        if (is_file($to)) {
            $this->error("{$to} already exists: choose another --out.");

            return self::FAILURE;
        }

        try {
            BackupCipher::decryptFile($from, $to);
        } catch (Throwable $e) {
            $this->error($e->getMessage());

            return self::FAILURE;
        }
        $this->info("Decrypted to {$to}. Restore it with: gunzip -c {$to} | mysql -u root <database>");

        return self::SUCCESS;
    }
}
