<?php

namespace Tests\Unit;

use App\Domain\Platform\Backups\BackupCipher;
use RuntimeException;
use Tests\TestCase;

/**
 * Phase 7 step 1 (2026-11-28): encrypted backups round-trip, and a wrong key / changed / cut-short file is refused.
 * Run:  php artisan test --filter=BackupCipherTest
 */
class BackupCipherTest extends TestCase
{
    private string $dir;

    protected function setUp(): void
    {
        parent::setUp();
        $this->dir = sys_get_temp_dir().'/advms-cipher-'.bin2hex(random_bytes(4));
        mkdir($this->dir);
    }

    protected function tearDown(): void
    {
        array_map('unlink', glob($this->dir.'/*') ?: []);
        rmdir($this->dir);
        parent::tearDown();
    }

    public function test_round_trip_across_many_pieces_and_an_empty_file(): void
    {
        foreach (['big' => random_bytes(512 * 1024 * 2 + 123), 'empty' => ''] as $name => $bytes) {
            file_put_contents("{$this->dir}/{$name}.gz", $bytes);
            BackupCipher::encryptFile("{$this->dir}/{$name}.gz", "{$this->dir}/{$name}.gz.enc");
            $this->assertStringStartsWith(BackupCipher::MAGIC, file_get_contents("{$this->dir}/{$name}.gz.enc"));
            if ($bytes !== '') {
                $this->assertStringNotContainsString(substr($bytes, 1000, 64), file_get_contents("{$this->dir}/{$name}.gz.enc"));
            }
            BackupCipher::decryptFile("{$this->dir}/{$name}.gz.enc", "{$this->dir}/{$name}.out");
            $this->assertSame($bytes, file_get_contents("{$this->dir}/{$name}.out"));
        }
    }

    public function test_wrong_key_changed_or_cut_files_are_refused(): void
    {
        file_put_contents("{$this->dir}/a.gz", random_bytes(700 * 1024));
        BackupCipher::encryptFile("{$this->dir}/a.gz", "{$this->dir}/a.enc");
        $good = file_get_contents("{$this->dir}/a.enc");

        $other = base64_decode(substr(BackupCipher::newKey(), 7));
        $this->assertRefused(fn () => BackupCipher::decryptFile("{$this->dir}/a.enc", "{$this->dir}/x1", $other));
        $this->assertFileDoesNotExist("{$this->dir}/x1"); // no half file left behind

        $changed = $good;
        $changed[200] = chr(ord($changed[200]) ^ 1);
        file_put_contents("{$this->dir}/b.enc", $changed);
        $this->assertRefused(fn () => BackupCipher::decryptFile("{$this->dir}/b.enc", "{$this->dir}/x2"));

        file_put_contents("{$this->dir}/c.enc", substr($good, 0, (int) (strlen($good) * 0.8)));
        $this->assertRefused(fn () => BackupCipher::decryptFile("{$this->dir}/c.enc", "{$this->dir}/x3"));
    }

    public function test_a_configured_key_is_used_and_checked(): void
    {
        config(['backup.encryption_key' => BackupCipher::newKey()]);
        $this->assertSame(32, strlen(BackupCipher::key()));
        config(['backup.encryption_key' => 'not-a-key']);
        $this->assertRefused(fn () => BackupCipher::key());
    }

    private function assertRefused(callable $fn): void
    {
        try {
            $fn();
            $this->fail('Expected the file to be refused');
        } catch (RuntimeException|\SodiumException $e) {
            $this->assertNotEmpty($e->getMessage());
        }
    }
}
