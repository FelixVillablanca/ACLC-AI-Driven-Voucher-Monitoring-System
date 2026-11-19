<?php

namespace App\Domain\Platform;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * READS the global rules that the Super Admin owns (table `system_settings`, one row per key).
 *
 * A KEY/VALUE table: instead of one column per setting, each setting is a row
 * ("approval.high_value_threshold" => "50000.00"). Adding a new setting later
 * needs no migration.
 *
 * Starting values are in DEFAULTS below; SystemSettingsSeeder writes them once.
 * A setting with no row is NOT SET, get() returns null, and the screen says "Not set".
 * Writing settings comes with the Global settings page (Framer tsrXCiWWw).
 */
class SystemSettings
{
    // The keys used so far. Keep them here so a typo can't create a second, different setting.
    public const HIGH_VALUE_THRESHOLD = 'approval.high_value_threshold'; // "50000.00" (money as a string, never a float)

    public const ANOMALY_SENSITIVITY = 'ai.anomaly_sensitivity';         // relaxed | balanced | strict

    public const OPENAI_MONTHLY_CAP_USD = 'openai.monthly_cap_usd';      // "25.00" (OpenAI bills in US dollars)

    public const SUPER_ADMIN_IDLE_TIMEOUT = 'security.super_admin_idle_timeout_minutes'; // 15 (spec §4.6: shorter session)

    /**
     * STARTING VALUES ("platform defaults"), written once by SystemSettingsSeeder.
     * Super Admins change them later on the Global settings page; the seeder never overwrites a saved value.
     *
     * @var array<string, array{value: mixed, group: string, description: string}>
     */
    public const DEFAULTS = [
        self::HIGH_VALUE_THRESHOLD => [
            'value' => '50000.00',
            'group' => 'approval',
            'description' => 'Vouchers above this amount also need the Supervisor/Manager (step 2).',
        ],
        self::ANOMALY_SENSITIVITY => [
            'value' => 'balanced',
            'group' => 'ai',
            'description' => 'How easily the AI flags a voucher as unusual: relaxed, balanced or strict.',
        ],
        self::OPENAI_MONTHLY_CAP_USD => [
            'value' => '25.00',
            'group' => 'openai',
            'description' => 'Most the platform may spend on OpenAI report summaries per month (US dollars).',
        ],
        self::SUPER_ADMIN_IDLE_TIMEOUT => [
            'value' => 15,
            'group' => 'security',
            'description' => 'Super Admins are signed out after this many minutes without activity.',
        ],
    ];

    /** @var array<string, mixed>|null all rows, loaded once per request */
    private ?array $values = null;

    /**
     * The saved value, or `$fallback` when nobody saved one yet.
     * Security rules pass their default as the fallback, so they work even before the seeder ran.
     */
    public function get(string $key, mixed $fallback = null): mixed
    {
        $this->values ??= DB::table('system_settings')->pluck('value', 'key')
            ->map(fn ($json) => $json === null ? null : json_decode($json, true))
            ->all();

        return $this->values[$key] ?? $fallback;
    }

    /**
     * Who changed a global rule last, and when ("last changed 2 h ago by Ana Cruz").
     *
     * @return array{at: string, by: string|null}|null null = nobody has changed anything yet
     */
    public function lastChange(): ?array
    {
        $row = DB::table('system_settings')
            ->leftJoin('users', 'users.id', '=', 'system_settings.updated_by')
            ->whereNotNull('system_settings.updated_at')
            ->orderByDesc('system_settings.updated_at')
            ->first(['system_settings.updated_at', 'users.first_name', 'users.last_name']);

        if (! $row) {
            return null;
        }

        return [
            'at' => Carbon::parse($row->updated_at)->toIso8601String(),
            'by' => trim("{$row->first_name} {$row->last_name}") ?: null,
        ];
    }
}
