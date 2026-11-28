<?php

namespace App\Domain\Identity\Support;

use App\Domain\Platform\Actions\UpdateGlobalSettings;
use App\Domain\Platform\SystemSettings;
use App\Models\User;

/**
 * The platform's "two-step is required" rules for a person who is NEW to a role (Phase 7 step 1, 2026-11-28):
 * an Accounting Officer or Supervisor / Manager created by an Admin, or moved into one of those roles, while the Global
 * setting "Require two-step for Accounting & Supervisors" is on, must set it up (3-day window, then sign-in waits).
 * (Admins: CreateAdmin applies "Require two-step for admins" itself.)
 */
class TwoFactorRules
{
    public static function applyFor(User $user): void
    {
        if (! in_array($user->role, SystemSettings::REVIEWER_ROLES, true) || $user->hasTwoFactor() || $user->two_factor_required_at !== null) {
            return;
        }
        if (app(SystemSettings::class)->value(SystemSettings::REQUIRE_TWO_FACTOR_FOR_REVIEWERS) !== true) {
            return;
        }
        $user->forceFill([
            'two_factor_required_at' => now(),
            'two_factor_setup_deadline' => now()->addDays(UpdateGlobalSettings::TWO_FACTOR_SETUP_DAYS),
        ])->save();
    }
}
