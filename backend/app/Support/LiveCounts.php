<?php

namespace App\Support;

use Closure;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * SHORT CACHE for the numbers every open tab asks for once a minute (Phase 7 Step 2, user decision 2026-11-28:
 * "cache 30 s, clear on change"): sidebar counts, the bell's unread count and the role dashboards.
 *
 * How it stays correct: each company (and each person, for the bell) has a VERSION stamp. Anything that changes a
 * voucher, budget or report of a company stamps a new version (`companyChanged`), so the next request recomputes
 * instead of waiting for the 30 seconds to pass. A cached answer is used only while its stamp still matches.
 * Where the stamp is renewed: write requests through the `company` middleware, the Voucher / budget / report model
 * events, the queued automatic check, and the Notification model (the bell).
 *
 * One cache row per (name, company, person): the stamp is stored INSIDE the value, not in the key, so old versions
 * never pile up in the cache table.
 */
final class LiveCounts
{
    /** Seconds an answer may be reused when nothing has changed (time-based parts such as "near the SLA" move slowly). */
    public const TTL = 30;

    /** A role's numbers for one person in one company (counts that include "your decisions today" are per person). */
    public static function forCompany(string $name, int $companyId, int $userId, Closure $compute): mixed
    {
        return self::remember("live:{$name}:c{$companyId}:u{$userId}", self::companyKey($companyId), $compute);
    }

    /** One person's numbers that don't depend on a company (the bell). */
    public static function forUser(string $name, int $userId, Closure $compute): mixed
    {
        return self::remember("live:{$name}:u{$userId}", self::userKey($userId), $compute);
    }

    /** A voucher, budget or report of this company changed: everyone's cached numbers for it are out of date. */
    public static function companyChanged(?int $companyId): void
    {
        if ($companyId) {
            self::stamp(self::companyKey($companyId));
        }
    }

    /** This person's notifications changed. */
    public static function userChanged(?int $userId): void
    {
        if ($userId) {
            self::stamp(self::userKey($userId));
        }
    }

    private static function remember(string $key, string $versionKey, Closure $compute): mixed
    {
        $version = (string) Cache::get($versionKey, '0');
        $hit = Cache::get($key);

        if (is_array($hit) && ($hit['v'] ?? null) === $version) {
            return $hit['d'];
        }

        $data = $compute();
        Cache::put($key, ['v' => $version, 'd' => $data], self::TTL);

        return $data;
    }

    /**
     * New stamp AFTER the database transaction commits (runs at once when there is none). Stamping earlier would let
     * another request cache the old numbers under the new stamp before the change is visible.
     */
    private static function stamp(string $versionKey): void
    {
        DB::afterCommit(fn () => Cache::forever($versionKey, (string) Str::ulid()));
    }

    private static function companyKey(int $companyId): string
    {
        return "live:version:c{$companyId}";
    }

    private static function userKey(int $userId): string
    {
        return "live:version:u{$userId}";
    }
}
