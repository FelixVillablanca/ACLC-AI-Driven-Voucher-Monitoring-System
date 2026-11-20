<?php

namespace App\Domain\Identity\Actions;

use App\Domain\Identity\Support\AccountActions;
use App\Domain\Security\Support\OwnerActivity;
use App\Mail\TwoFactorSetupMail;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Throwable;

/**
 * "Require two-step sign-in" (Admins tab A11, frame x8wWbSPsg).
 *
 *   1. At their next sign-in, after the password, they're shown a QR code to set it up.
 *   2. Until the setup window ends (1, 3 or 7 days) they may choose "set up later";
 *      after that, sign-in waits until it's done (and anyone still signed in is signed out).
 *   3. They can't turn it off themselves.
 *
 * Returns whether the "setup steps" email went out (null = not asked for).
 */
class RequireTwoFactor
{
    public const SETUP_DAYS = [1, 3, 7];

    public function handle(User $target, User $by, int $setupDays, bool $emailSteps, ?string $ip): ?bool
    {
        DB::transaction(function () use ($target, $by, $setupDays, $ip) {
            $target = User::whereKey($target->id)->lockForUpdate()->firstOrFail();
            AccountActions::authorize($by, $target, 'require_two_factor');

            $target->forceFill([
                'two_factor_required_at' => now(),
                'two_factor_setup_deadline' => now()->addDays($setupDays),
            ])->save();

            OwnerActivity::audit($by, 'two_factor_required', 'users', $target->id, null,
                ['setup_days' => $setupDays, 'deadline' => now()->addDays($setupDays)->toIso8601String()], $ip, $target->company_id);
        });

        if (! $emailSteps) {
            return null;
        }
        if (! $target->personal_email) {
            return false;
        }

        try {
            Mail::to($target->personal_email)->send(new TwoFactorSetupMail($target->fresh(), $setupDays));

            return true;
        } catch (Throwable $e) {
            Log::error('Two-step setup email failed', ['user_id' => $target->id, 'error' => $e->getMessage()]);

            return false; // two-step is still required; only the courtesy email is missing
        }
    }
}
