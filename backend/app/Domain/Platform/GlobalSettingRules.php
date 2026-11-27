<?php

namespace App\Domain\Platform;

/**
 * WHAT A VALID VALUE IS for each global setting (one place, used by the save request).
 * The screen offers the same choices, but the server never trusts the screen.
 *
 * normalize() turns what the browser sent into the stored form:
 * money "50000" → "50000.00" (a string, never a float), numbers → int, switches → bool.
 */
class GlobalSettingRules
{
    public const SENSITIVITIES = ['relaxed', 'balanced', 'strict'];

    public const IDLE_MINUTES = [5, 10, 15, 30, 60];

    public const FAILED_SIGN_IN_LIMITS = [3, 5, 10];

    public const REVIEW_SLA_HOURS = [24, 48, 72, 96];

    /** Laravel validation rules for the `value` of one setting. */
    public static function rules(string $key): array
    {
        return match ($key) {
            SystemSettings::HIGH_VALUE_THRESHOLD => ['required', 'numeric', 'min:1', 'max:999999999.99', 'decimal:0,2'],
            SystemSettings::BUDGET_CHANGE_SIGNOFF_ABOVE => ['required', 'numeric', 'min:0', 'max:999999999.99', 'decimal:0,2'],
            SystemSettings::OPENAI_MONTHLY_CAP_USD => ['required', 'numeric', 'min:0', 'max:1000', 'decimal:0,2'],
            SystemSettings::ANOMALY_SENSITIVITY => ['required', 'in:'.implode(',', self::SENSITIVITIES)],
            SystemSettings::CATEGORY_MIN_CONFIDENCE => ['required', 'integer', 'min:50', 'max:95', 'multiple_of:5'],
            SystemSettings::SUPER_ADMIN_IDLE_TIMEOUT => ['required', 'integer', 'in:'.implode(',', self::IDLE_MINUTES)],
            SystemSettings::FAILED_SIGN_IN_ALERT_AFTER => ['required', 'integer', 'in:'.implode(',', self::FAILED_SIGN_IN_LIMITS)],
            SystemSettings::REVIEW_SLA_HOURS => ['required', 'integer', 'in:'.implode(',', self::REVIEW_SLA_HOURS)],
            SystemSettings::AI_FLAGGED_NEEDS_STEP_2,
            SystemSettings::OPENAI_PAUSE_AT_CAP,
            SystemSettings::REQUIRE_TWO_FACTOR_FOR_ADMINS => ['required', 'boolean'],
        };
    }

    public static function normalize(string $key, mixed $value): mixed
    {
        return match ($key) {
            SystemSettings::HIGH_VALUE_THRESHOLD,
            SystemSettings::BUDGET_CHANGE_SIGNOFF_ABOVE,
            SystemSettings::OPENAI_MONTHLY_CAP_USD => self::money($value),
            SystemSettings::CATEGORY_MIN_CONFIDENCE,
            SystemSettings::SUPER_ADMIN_IDLE_TIMEOUT,
            SystemSettings::FAILED_SIGN_IN_ALERT_AFTER,
            SystemSettings::REVIEW_SLA_HOURS => (int) $value,
            SystemSettings::AI_FLAGGED_NEEDS_STEP_2,
            SystemSettings::OPENAI_PAUSE_AT_CAP,
            SystemSettings::REQUIRE_TWO_FACTOR_FOR_ADMINS => filter_var($value, FILTER_VALIDATE_BOOLEAN),
            default => $value,
        };
    }

    /** "50000" / "50000.5" / 50000 → "50000.00", without going through a float (bcmath-free). */
    private static function money(mixed $value): string
    {
        [$whole, $cents] = array_pad(explode('.', trim((string) $value), 2), 2, '');
        $whole = ltrim($whole, '0') ?: '0';

        return $whole.'.'.str_pad(substr($cents, 0, 2), 2, '0');
    }
}
