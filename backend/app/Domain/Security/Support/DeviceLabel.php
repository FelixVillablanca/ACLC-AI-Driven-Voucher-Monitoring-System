<?php

namespace App\Domain\Security\Support;

/**
 * Turns a browser's "user agent" text (a long technical string every browser sends)
 * into something a person can read: "Chrome on Android".
 *
 * It's deliberately simple: only the browser family and the operating system.
 * That's enough to notice "this Admin never used an Android phone before".
 */
class DeviceLabel
{
    public static function from(?string $userAgent): ?string
    {
        if (! $userAgent) {
            return null;
        }

        return self::browser($userAgent).' on '.self::system($userAgent);
    }

    private static function browser(string $ua): string
    {
        // Order matters: Edge and Opera also say "Chrome", and Chrome also says "Safari".
        return match (true) {
            str_contains($ua, 'Edg/') => 'Edge',
            str_contains($ua, 'OPR/') || str_contains($ua, 'Opera') => 'Opera',
            str_contains($ua, 'Firefox/') || str_contains($ua, 'FxiOS') => 'Firefox',
            str_contains($ua, 'Chrome/') || str_contains($ua, 'CriOS') => 'Chrome',
            str_contains($ua, 'Safari/') => 'Safari',
            default => 'Unknown browser',
        };
    }

    private static function system(string $ua): string
    {
        return match (true) {
            str_contains($ua, 'Android') => 'Android',
            str_contains($ua, 'iPhone') || str_contains($ua, 'iPad') => 'iOS',
            str_contains($ua, 'Windows') => 'Windows',
            str_contains($ua, 'Mac OS X') || str_contains($ua, 'Macintosh') => 'macOS',
            str_contains($ua, 'CrOS') => 'ChromeOS',
            str_contains($ua, 'Linux') => 'Linux',
            default => 'an unknown system',
        };
    }
}
