<?php

namespace App\Domain\Platform\Backups;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Process;
use Illuminate\Support\Facades\Storage;
use RuntimeException;

/**
 * Copies the whole database into ONE compressed file:
 *   1. mysqldump writes every table + row to a temporary .sql file
 *      --single-transaction = a consistent snapshot WITHOUT locking tables,
 *      so people can keep working while it runs (InnoDB tables)
 *   2. the .sql file is gzip-compressed into storage/app/private/backups/…sql.gz
 *   3. (Phase 7, 2026-11-28) the .gz is ENCRYPTED into …sql.gz.enc (BackupCipher, config backup.encrypt, on by default)
 *      and the unencrypted copies are deleted; `php artisan backup:decrypt <file>` gives the .sql.gz back
 *   4. the temporary file is deleted
 *
 * The database password goes to mysqldump through the MYSQL_PWD environment variable,
 * never on the command line (other programs on the computer can read command lines).
 *
 * Returns ['path' => 'backups/advms-2026-11-21-020000.sql.gz.enc', 'size_bytes' => 1234].
 */
class DumpDatabase
{
    public function handle(string $fileName): array
    {
        $connection = config('database.connections.'.config('database.default'));
        $directory = config('backup.directory');
        $disk = Storage::disk('local'); // = storage/app/private
        $disk->makeDirectory($directory);

        $sqlFile = $disk->path($directory.'/'.$fileName.'.sql.tmp');
        $gzPath = $directory.'/'.$fileName.'.sql.gz';
        $encrypt = (bool) config('backup.encrypt');
        $finalPath = $encrypt ? $gzPath.'.enc' : $gzPath;

        try {
            $result = Process::timeout((int) config('backup.timeout_seconds'))
                ->env(['MYSQL_PWD' => (string) ($connection['password'] ?? '')])
                ->run([
                    config('backup.mysqldump'),
                    '--host='.$connection['host'],
                    '--port='.$connection['port'],
                    '--user='.$connection['username'],
                    '--single-transaction',
                    '--quick',
                    '--routines',
                    '--triggers',
                    '--default-character-set=utf8mb4',
                    '--result-file='.$sqlFile,
                    $connection['database'],
                ]);

            if (! $result->successful() || ! is_file($sqlFile) || filesize($sqlFile) === 0) {
                throw new RuntimeException('mysqldump failed: '.trim($result->errorOutput() ?: $result->output() ?: 'no output'));
            }

            $this->gzip($sqlFile, $disk->path($gzPath));
            if ($encrypt) {
                BackupCipher::encryptFile($disk->path($gzPath), $disk->path($finalPath));
            }
        } finally {
            if (is_file($sqlFile)) {
                unlink($sqlFile);
            }
            if ($encrypt && is_file($disk->path($gzPath))) {
                unlink($disk->path($gzPath)); // only the encrypted copy stays
            }
        }

        return ['path' => $finalPath, 'size_bytes' => $disk->size($finalPath)];
    }

    /** How big the database is right now (data + indexes), for "Database size" and the time estimate. */
    public static function databaseSizeBytes(): int
    {
        return (int) DB::table('information_schema.tables')
            ->where('table_schema', DB::connection()->getDatabaseName())
            ->sum(DB::raw('data_length + index_length'));
    }

    /** Streams the file through gzip in small pieces, so a big dump never has to fit in memory. */
    private function gzip(string $from, string $to): void
    {
        $in = fopen($from, 'rb');
        $out = gzopen($to, 'wb6');
        if (! $in || ! $out) {
            throw new RuntimeException('Could not create the backup file.');
        }
        while (! feof($in)) {
            gzwrite($out, fread($in, 1024 * 512));
        }
        fclose($in);
        gzclose($out);
    }
}
