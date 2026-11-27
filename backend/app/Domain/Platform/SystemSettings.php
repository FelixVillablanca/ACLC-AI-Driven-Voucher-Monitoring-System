<?php

namespace App\Domain\Platform;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * READS the global rules that the Super Admin owns (table `system_settings`, one row per key).
 *
 * A KEY/VALUE table: instead of one column per setting, each setting is a row
 * ("approval.high_value_threshold" => "50000.00"). Adding a new setting later
 * needs no migration: add it to DEFAULTS and SystemSettingsSeeder writes its row.
 *
 * A setting with no row yet is NOT SET: get() returns the fallback you pass (or null), and
 * value() returns the platform default. Writing is done by UpdateGlobalSettings (Global settings
 * page, Framer tsrXCiWWw), which also checks each value (GlobalSettingRules).
 */
class SystemSettings
{
    // The keys. Keep them here so a typo can't create a second, different setting.
    public const HIGH_VALUE_THRESHOLD = 'approval.high_value_threshold'; // "50000.00" (money as a string, never a float)

    public const AI_FLAGGED_NEEDS_STEP_2 = 'approval.ai_flagged_needs_step2'; // true: an AI-flagged voucher always needs step 2

    public const REVIEW_SLA_HOURS = 'approval.review_sla_hours';         // 48: Accounting should review a voucher within this (warning only)

    public const BUDGET_CHANGE_SIGNOFF_ABOVE = 'budget.change_signoff_above'; // "250000.00": bigger budget edits need a Supervisor (2026-11-27)

    public const ANOMALY_SENSITIVITY = 'ai.anomaly_sensitivity';         // relaxed | balanced | strict

    public const CATEGORY_MIN_CONFIDENCE = 'ai.category_min_confidence'; // 70 (%): below this the clerk sees no suggestion

    public const OPENAI_MONTHLY_CAP_USD = 'openai.monthly_cap_usd';      // "25.00" (OpenAI bills in US dollars)

    public const OPENAI_PAUSE_AT_CAP = 'openai.pause_at_cap';            // true: stop summaries when the cap is reached

    public const SUPER_ADMIN_IDLE_TIMEOUT = 'security.super_admin_idle_timeout_minutes'; // 15 (spec §4.6: shorter session)

    public const FAILED_SIGN_IN_ALERT_AFTER = 'security.failed_sign_in_alert_after'; // 5 failed sign-ins in 5 min → High alert

    public const REQUIRE_TWO_FACTOR_FOR_ADMINS = 'security.require_two_factor_for_admins'; // false

    /**
     * STARTING VALUES ("platform defaults"), written once by SystemSettingsSeeder.
     * Super Admins change them later on the Global settings page; the seeder never overwrites a saved value.
     * `label` is the name people read (Change history, notifications).
     *
     * @var array<string, array{value: mixed, group: string, label: string, description: string}>
     */
    public const DEFAULTS = [
        self::HIGH_VALUE_THRESHOLD => [
            'value' => '50000.00',
            'group' => 'approval',
            'label' => 'High-value threshold',
            'description' => 'Vouchers at or above this amount also need the Supervisor/Manager (step 2).',
        ],
        self::AI_FLAGGED_NEEDS_STEP_2 => [
            'value' => true,
            'group' => 'approval',
            'label' => 'Send AI-flagged vouchers to step 2',
            'description' => 'Any voucher the anomaly check flags needs the Supervisor/Manager, whatever the amount.',
        ],
        self::REVIEW_SLA_HOURS => [
            'value' => 48,
            'group' => 'approval',
            'label' => 'Review within (hours)',
            'description' => 'How long a voucher may wait for Accounting. Past 75% of it the queue warns; it never blocks.',
        ],
        self::BUDGET_CHANGE_SIGNOFF_ABOVE => [
            'value' => '250000.00',
            'group' => 'approval',
            'label' => 'Budget changes need sign-off above',
            'description' => 'An Accounting Officer’s budget edit bigger than this waits for a Supervisor / Manager to sign it off.',
        ],
        self::ANOMALY_SENSITIVITY => [
            'value' => 'balanced',
            'group' => 'ai',
            'label' => 'Anomaly sensitivity',
            'description' => 'How easily the AI flags a voucher as unusual: relaxed, balanced or strict.',
        ],
        self::CATEGORY_MIN_CONFIDENCE => [
            'value' => 70,
            'group' => 'ai',
            'label' => 'Show category suggestions from',
            'description' => 'Clerks only see an AI category suggestion when the AI is at least this sure (%).',
        ],
        self::OPENAI_MONTHLY_CAP_USD => [
            'value' => '25.00',
            'group' => 'openai',
            'label' => 'Monthly spend cap',
            'description' => 'Most the platform may spend on OpenAI report summaries per month (US dollars).',
        ],
        self::OPENAI_PAUSE_AT_CAP => [
            'value' => true,
            'group' => 'openai',
            'label' => 'Pause summaries at the cap',
            'description' => 'When the cap is reached, reports still build, just without the AI summary.',
        ],
        self::SUPER_ADMIN_IDLE_TIMEOUT => [
            'value' => 15,
            'group' => 'security',
            'label' => 'Super Admin idle sign-out',
            'description' => 'Super Admins are signed out after this many minutes without activity.',
        ],
        self::FAILED_SIGN_IN_ALERT_AFTER => [
            'value' => 5,
            'group' => 'security',
            'label' => 'Security alert after failed sign-ins',
            'description' => 'This many failed sign-ins for one account within 5 minutes raises a High security alert.',
        ],
        self::REQUIRE_TWO_FACTOR_FOR_ADMINS => [
            'value' => false,
            'group' => 'security',
            'label' => 'Require two-step for admins',
            'description' => 'Every Admin must set up two-step sign-in (an authenticator app).',
        ],
    ];

    /** The Global settings sections, in screen order (Change history filter tabs too). */
    public const GROUPS = ['approval', 'ai', 'openai', 'security'];

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

    /** The saved value, or the platform default when there's no row yet. */
    public function value(string $key): mixed
    {
        return $this->get($key, self::DEFAULTS[$key]['value'] ?? null);
    }

    /** Every editable setting with its current value: [key => value]. */
    public function all(): array
    {
        return collect(self::DEFAULTS)->mapWithKeys(fn ($d, $key) => [$key => $this->value($key)])->all();
    }

    /** Forget the values read earlier in this request (after a save). */
    public function refresh(): void
    {
        $this->values = null;
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
