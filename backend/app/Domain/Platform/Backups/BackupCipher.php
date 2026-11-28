<?php

namespace App\Domain\Platform\Backups;

use RuntimeException;

/**
 * Encrypted backups (Phase 7 step 1, 2026-11-28). A backup file is encrypted in pieces of 512 KB with libsodium's
 * secretstream (XChaCha20-Poly1305): anyone who copies the file without the key reads nothing, and a file that was
 * changed or cut short is REFUSED when it is decrypted (every piece carries its own check, the last one is marked).
 *
 * File layout: "ADVMSBK1" (8 bytes) · the stream header · then each piece = 4-byte length + encrypted bytes.
 * Key: BACKUP_ENCRYPTION_KEY (base64 of 32 random bytes; `php artisan backup:key` prints one). Without it, a key is
 * derived from APP_KEY: then changing APP_KEY makes older backups unreadable, so set a separate key in production
 * and keep it somewhere safe outside the server (a password manager).
 */
class BackupCipher
{
    public const MAGIC = 'ADVMSBK1';

    private const CHUNK = 512 * 1024;

    public static function key(): string
    {
        $configured = (string) config('backup.encryption_key');
        if ($configured !== '') {
            $raw = base64_decode(preg_replace('/^base64:/', '', $configured), true);
            if ($raw === false || strlen($raw) !== SODIUM_CRYPTO_SECRETSTREAM_XCHACHA20POLY1305_KEYBYTES) {
                throw new RuntimeException('BACKUP_ENCRYPTION_KEY must be base64 of 32 bytes (run php artisan backup:key).');
            }

            return $raw;
        }
        $appKey = (string) config('app.key');
        $appKey = str_starts_with($appKey, 'base64:') ? base64_decode(substr($appKey, 7)) : $appKey;
        if ($appKey === '') {
            throw new RuntimeException('No APP_KEY and no BACKUP_ENCRYPTION_KEY: backups can\'t be encrypted.');
        }

        return hash_hkdf('sha256', $appKey, SODIUM_CRYPTO_SECRETSTREAM_XCHACHA20POLY1305_KEYBYTES, 'advms-backup-v1');
    }

    public static function newKey(): string
    {
        return 'base64:'.base64_encode(sodium_crypto_secretstream_xchacha20poly1305_keygen());
    }

    public static function encryptFile(string $from, string $to, ?string $key = null): void
    {
        $in = fopen($from, 'rb');
        $out = fopen($to, 'wb');
        if (! $in || ! $out) {
            throw new RuntimeException('Could not open the backup file for encryption.');
        }
        try {
            [$state, $header] = sodium_crypto_secretstream_xchacha20poly1305_init_push($key ?? self::key());
            fwrite($out, self::MAGIC.$header);
            $piece = fread($in, self::CHUNK);
            do {
                $next = feof($in) ? '' : fread($in, self::CHUNK);
                $last = $next === '' || $next === false;
                $tag = $last ? SODIUM_CRYPTO_SECRETSTREAM_XCHACHA20POLY1305_TAG_FINAL : SODIUM_CRYPTO_SECRETSTREAM_XCHACHA20POLY1305_TAG_MESSAGE;
                $cipher = sodium_crypto_secretstream_xchacha20poly1305_push($state, (string) $piece, '', $tag);
                fwrite($out, pack('N', strlen($cipher)).$cipher);
                $piece = $next;
            } while (! $last);
        } finally {
            fclose($in);
            fclose($out);
        }
    }

    public static function decryptFile(string $from, string $to, ?string $key = null): void
    {
        $in = fopen($from, 'rb');
        if (! $in) {
            throw new RuntimeException('Could not open the backup file.');
        }
        $out = null;
        try {
            if (fread($in, strlen(self::MAGIC)) !== self::MAGIC) {
                throw new RuntimeException('This isn\'t an encrypted ADVMS backup.');
            }
            $header = fread($in, SODIUM_CRYPTO_SECRETSTREAM_XCHACHA20POLY1305_HEADERBYTES);
            $state = sodium_crypto_secretstream_xchacha20poly1305_init_pull($header, $key ?? self::key());
            $out = fopen($to, 'wb');
            $finished = false;
            while (! $finished) {
                $len = fread($in, 4);
                if ($len === '' || $len === false || strlen($len) < 4) {
                    throw new RuntimeException('The backup file ends too early: it was cut short.');
                }
                $cipher = fread($in, unpack('N', $len)[1]);
                $result = sodium_crypto_secretstream_xchacha20poly1305_pull($state, (string) $cipher);
                if ($result === false) {
                    throw new RuntimeException('Wrong key, or the backup file was changed.');
                }
                [$plain, $tag] = $result;
                fwrite($out, $plain);
                $finished = $tag === SODIUM_CRYPTO_SECRETSTREAM_XCHACHA20POLY1305_TAG_FINAL;
            }
            if (fread($in, 1) !== '') {
                throw new RuntimeException('There is extra data after the end of the backup.');
            }
        } catch (\Throwable $e) {
            if ($out) {
                fclose($out);
                $out = null;
                @unlink($to); // never leave half a backup behind
            }
            throw $e;
        } finally {
            fclose($in);
            if ($out) {
                fclose($out);
            }
        }
    }
}
