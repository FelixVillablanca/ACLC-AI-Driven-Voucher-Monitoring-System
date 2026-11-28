<?php

namespace App\Domain\Platform\Actions;

use App\Domain\Identity\Actions\RequireTwoFactor;
use App\Domain\Platform\SystemSettings;
use App\Domain\Security\Support\OwnerActivity;
use App\Exceptions\ApiException;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * "Save changes" on the Global settings page (Framer G3 xICKww9ng).
 *
 * One transaction:
 *   1. LOCK the setting rows being changed.
 *   2. OPTIMISTIC CONCURRENCY CHECK: the screen sends the value each setting had when the page was
 *      loaded ("was"). If another Super Admin saved a different value in the meantime, nothing is
 *      saved and the answer is 409 SETTINGS_CHANGED, so nobody silently overwrites someone else.
 *   3. Write each new value + one audit row per change (with the reason): that IS the Change history.
 *   4. A bell notice for the other Super Admins.
 * After the commit: the optional notice to every Admin, and (when "Require two-step for admins"
 * was just turned on) the two-step requirement for every Admin who hasn't set it up.
 */
class UpdateGlobalSettings
{
    /** The setup window given to Admins when the platform rule turns two-step on. */
    public const TWO_FACTOR_SETUP_DAYS = 3;

    public function __construct(private SystemSettings $settings, private RequireTwoFactor $requireTwoFactor) {}

    /**
     * @param  array<int, array{key: string, value: mixed, was: mixed}>  $changes  already normalized
     * @return array{changed: array<int, string>, admins_notified: ?int, two_factor_required: ?int}
     */
    public function handle(User $by, array $changes, string $reason, bool $notifyAdmins, ?string $ip): array
    {
        $changed = DB::transaction(function () use ($by, $changes, $reason, $ip) {
            $keys = array_column($changes, 'key');
            $rows = DB::table('system_settings')->whereIn('key', $keys)->lockForUpdate()->get()->keyBy('key');

            $stale = [];
            $real = [];
            foreach ($changes as $change) {
                $key = $change['key'];
                $current = isset($rows[$key]) ? json_decode($rows[$key]->value, true) : SystemSettings::DEFAULTS[$key]['value'];
                if ($current !== $change['was']) {
                    $stale[] = SystemSettings::DEFAULTS[$key]['label'];
                } elseif ($current !== $change['value']) {
                    $real[] = [...$change, 'current' => $current];
                }
            }

            if ($stale !== []) {
                throw new ApiException(
                    'Another Super Admin changed '.implode(' and ', $stale).' while you were editing. Reload to see their values, then make your change again.',
                    'SETTINGS_CHANGED', 409);
            }
            if ($real === []) {
                throw new ApiException('Nothing to save: these settings already have those values.', 'NOTHING_CHANGED', 409);
            }

            $now = now();
            foreach ($real as $change) {
                $key = $change['key'];
                $default = SystemSettings::DEFAULTS[$key];
                DB::table('system_settings')->updateOrInsert(['key' => $key], [
                    'value' => json_encode($change['value']),
                    'group' => $default['group'],
                    'description' => $default['description'],
                    'updated_by' => $by->id,
                    'updated_at' => $now,
                    ...(isset($rows[$key]) ? [] : ['created_at' => $now]),
                ]);
                $id = $rows[$key]->id ?? DB::table('system_settings')->where('key', $key)->value('id');

                OwnerActivity::audit($by, 'setting_changed', 'system_settings', $id,
                    ['key' => $key, 'group' => $default['group'], 'value' => $change['current']],
                    ['key' => $key, 'group' => $default['group'], 'value' => $change['value'], 'reason' => $reason],
                    $ip);
            }

            $labels = array_map(fn ($c) => SystemSettings::DEFAULTS[$c['key']]['label'], $real);
            OwnerActivity::tellOtherOwners($by, 'system_alert', 'Global settings changed',
                "{$by->full_name} changed ".implode(', ', $labels).": \"{$reason}\".");

            return $real;
        });

        $this->settings->refresh();
        $keys = array_column($changed, 'key');

        return [
            'changed' => $keys,
            'admins_notified' => $notifyAdmins ? $this->notifyAdmins($by, $changed, $reason) : null,
            'two_factor_required' => $this->turnedOn($changed, SystemSettings::REQUIRE_TWO_FACTOR_FOR_ADMINS)
                ? $this->requireTwoFactorForAdmins($by, $ip)
                : null,
            'two_factor_required_reviewers' => $this->turnedOn($changed, SystemSettings::REQUIRE_TWO_FACTOR_FOR_REVIEWERS)
                ? $this->requireTwoFactorForReviewers($by, $ip)
                : null,
        ];
    }

    /** A bell notice for every active Admin. Returns how many were told. */
    private function notifyAdmins(User $by, array $changed, string $reason): int
    {
        $labels = array_map(fn ($c) => SystemSettings::DEFAULTS[$c['key']]['label'], $changed);
        $ids = User::where('role', 'admin')->where('is_active', true)->pluck('id');

        foreach ($ids as $id) {
            Notification::create([
                'recipient_id' => $id,
                'type' => 'system_alert',
                'title' => 'Platform rules changed',
                'message' => 'A Super Admin changed: '.implode(', ', $labels).". Reason: \"{$reason}\".",
            ]);
        }

        return $ids->count();
    }

    private function turnedOn(array $changed, string $key): bool
    {
        foreach ($changed as $change) {
            if ($change['key'] === $key && $change['value'] === true) {
                return true;
            }
        }

        return false;
    }

    /**
     * The platform rule was just turned on: every active Admin who has signed up but has no two-step
     * yet gets the same "Require two-step" as A11 (3-day setup window, setup email).
     * Pending Admins get it when they're created/sign in (CreateAdmin reads the rule).
     */
    private function requireTwoFactorForAdmins(User $by, ?string $ip): int
    {
        $count = 0;
        $admins = User::where('role', 'admin')->where('is_active', true)->where('access_status', 'accepted')
            ->whereNull('two_factor_confirmed_at')->whereNull('two_factor_required_at')->get();

        foreach ($admins as $admin) {
            try {
                $this->requireTwoFactor->handle($admin, $by, self::TWO_FACTOR_SETUP_DAYS, true, $ip);
                $count++;
            } catch (Throwable $e) {
                // one account that can't be changed doesn't stop the others; the setting itself is saved
                Log::warning('Could not require two-step for an Admin', ['user_id' => $admin->id, 'error' => $e->getMessage()]);
            }
        }

        return $count;
    }

    /**
     * "Require two-step for Accounting & Supervisors" was just turned on (Phase 7 step 1, 2026-11-28): every active
     * Accounting Officer and Supervisor / Manager without two-step gets the same 3-day setup window (+ the setup email).
     * New ones get it when they're created (CreateUser) or moved into one of those roles (UpdateCompanyUser).
     */
    private function requireTwoFactorForReviewers(User $by, ?string $ip): int
    {
        $count = 0;
        $people = User::whereIn('role', SystemSettings::REVIEWER_ROLES)->where('is_active', true)
            ->whereNull('two_factor_confirmed_at')->whereNull('two_factor_required_at')->get();

        foreach ($people as $person) {
            try {
                $this->requireTwoFactor->byRule($person, $by, self::TWO_FACTOR_SETUP_DAYS, true, $ip);
                $count++;
            } catch (Throwable $e) {
                Log::warning('Could not require two-step for a reviewer', ['user_id' => $person->id, 'error' => $e->getMessage()]);
            }
        }

        return $count;
    }
}
