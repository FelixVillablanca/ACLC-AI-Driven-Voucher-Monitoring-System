<?php

namespace App\Domain\Audit;

use DateTimeInterface;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * THE ONE WAY to write to the audit log (`audit_logs`). Every module calls AuditTrail::record()
 * instead of inserting rows itself, so every entry gets the same extras:
 *
 *   request_id  the id of the API request that caused it ("req_…", AssignRequestId), so the
 *               entries of one click can be shown together ("Same request", Framer AL7)
 *   user_agent  the browser, when it happened during a web request and the caller didn't give one
 *   hash        a FINGERPRINT: HMAC-SHA256 of the whole row, keyed with the app's secret key.
 *               Nobody can edit a row in the database and produce a matching fingerprint without
 *               that key, so verify() tells "untouched" from "changed after it was written".
 *
 * The log is APPEND-ONLY: this class only ever inserts (and seals the row it just inserted).
 */
class AuditTrail
{
    /**
     * @param  array<string, mixed>  $row  user_id, company_id, action, table_name, record_id,
     *                                     old_values / new_values (array or JSON string), ip_address, user_agent
     * @return int the new entry's id
     */
    public static function record(array $row): int
    {
        $now = self::timestamp($row['created_at'] ?? now());
        $request = app()->runningInConsole() && ! app()->runningUnitTests() ? null : request();

        $row = [
            'user_id' => $row['user_id'] ?? null,
            'company_id' => $row['company_id'] ?? null,
            'action' => $row['action'],
            'table_name' => $row['table_name'],
            'record_id' => $row['record_id'] ?? null,
            'old_values' => self::json($row['old_values'] ?? null),
            'new_values' => self::json($row['new_values'] ?? null),
            'ip_address' => $row['ip_address'] ?? null,
            'user_agent' => self::agent($row['user_agent'] ?? $request?->userAgent()),
            'request_id' => $row['request_id'] ?? $request?->attributes->get('request_id'),
            'created_at' => $now,
            'updated_at' => $now,
        ];

        $id = DB::table('audit_logs')->insertGetId($row);
        // the id is part of the fingerprint, so a row can't be copied over another one either
        DB::table('audit_logs')->where('id', $id)->update(['hash' => self::fingerprint(['id' => $id, ...$row])]);

        return $id;
    }

    /** true = untouched, false = changed after it was written, null = written before fingerprints existed. */
    public static function verify(object|array $row): ?bool
    {
        $row = (array) $row;
        if (empty($row['hash'])) {
            return null;
        }

        return hash_equals($row['hash'], self::fingerprint($row));
    }

    /** HMAC of the row's stored values, in a fixed order. */
    public static function fingerprint(array $row): string
    {
        $parts = [];
        foreach (['id', 'user_id', 'company_id', 'action', 'table_name', 'record_id', 'old_values', 'new_values',
            'ip_address', 'user_agent', 'request_id', 'created_at'] as $field) {
            $value = $row[$field] ?? null;
            $parts[] = $value === null ? "\0" : (string) self::timestamp($value);
        }

        return hash_hmac('sha256', implode("\x1F", $parts), (string) config('app.key'));
    }

    private static function json(mixed $value): ?string
    {
        return $value === null || is_string($value) ? $value : json_encode($value);
    }

    private static function agent(?string $userAgent): ?string
    {
        return $userAgent ? Str::limit($userAgent, 500, '') : null;
    }

    /** Dates are stored and fingerprinted as "Y-m-d H:i:s" (what the database gives back). */
    private static function timestamp(mixed $value): mixed
    {
        if ($value instanceof DateTimeInterface) {
            return Carbon::instance($value)->format('Y-m-d H:i:s');
        }

        return $value;
    }
}
