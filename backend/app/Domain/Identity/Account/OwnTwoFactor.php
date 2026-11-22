<?php

namespace App\Domain\Identity\Account;

use App\Domain\Audit\AuditTrail;
use App\Domain\Identity\Support\TwoFactor;
use App\Domain\Platform\SystemSettings;
use App\Domain\Security\Actions\RaiseSecurityAlert;
use App\Exceptions\ApiException;
use App\Models\SecurityAlert;
use App\Models\User;
use Illuminate\Contracts\Session\Session;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Two-step sign-in from Account settings, while already signed in:
 *   setup()          a new key + QR code (kept in the session for 10 minutes, saved only after a correct code)
 *   enable()         first correct code → on, returns the 8 backup codes ONCE
 *   newRecoveryCodes()  replaces all backup codes (the old ones stop working)
 *   disable()        turns it off, unless something requires it (whyCantTurnOff)
 *
 * The sign-in screen has its own setup (TwoFactorLoginController) for people who must set it up
 * before they can get in. Both use the same TwoFactor helper.
 */
class OwnTwoFactor
{
    private const SESSION_KEY = 'account.two_factor_setup';

    private const SETUP_MINUTES = 10;

    public function __construct(private TwoFactor $twoFactor, private RaiseSecurityAlert $raise) {}

    /**
     * Why "Turn off" isn't allowed (null = it is):
     *   - an Admin, while the Global setting "Require two-step for admins" is on
     *   - a Super Admin required it for this account (the audit log remembers, even after setup)
     */
    public static function whyCantTurnOff(User $user): ?string
    {
        if ($user->role === 'admin' && app(SystemSettings::class)->value(SystemSettings::REQUIRE_TWO_FACTOR_FOR_ADMINS)) {
            return 'Two-step sign-in is required for every Admin (a Global setting).';
        }
        $required = $user->two_factor_required_at !== null || DB::table('audit_logs')
            ->where('action', 'two_factor_required')->where('table_name', 'users')->where('record_id', $user->id)->exists();
        if ($required) {
            return 'A Super Admin requires two-step sign-in for your account.';
        }

        return null;
    }

    /** @return array{qr_svg: string, secret: string} */
    public function setup(User $user, Session $session): array
    {
        if ($user->hasTwoFactor()) {
            throw new ApiException('Two-step sign-in is already on.', 'TWO_FACTOR_ALREADY_ON', 409);
        }

        $saved = $session->get(self::SESSION_KEY);
        $secret = ($saved && $saved['user_id'] === $user->id && $saved['expires_at'] > now()->timestamp)
            ? $saved['secret']
            : $this->twoFactor->newSecret();

        $session->put(self::SESSION_KEY, [
            'user_id' => $user->id,
            'secret' => $secret,
            'expires_at' => now()->addMinutes(self::SETUP_MINUTES)->timestamp,
        ]);

        return [
            'qr_svg' => $this->twoFactor->qrSvg($user, $secret),
            'secret' => trim(chunk_split($secret, 4, ' ')), // grouped by 4 so it's easier to type
        ];
    }

    /** @return array<int, string> the backup codes, shown once */
    public function enable(User $user, Session $session, string $code, ?string $ip): array
    {
        if ($user->hasTwoFactor()) {
            throw new ApiException('Two-step sign-in is already on.', 'TWO_FACTOR_ALREADY_ON', 409);
        }

        $saved = $session->get(self::SESSION_KEY);
        if (! $saved || $saved['user_id'] !== $user->id || $saved['expires_at'] < now()->timestamp) {
            throw new ApiException('The QR code expired. Start again to get a new one.', 'TWO_FACTOR_SETUP_EXPIRED', 409);
        }
        if (! $this->twoFactor->verify($user, $saved['secret'], $code)) {
            throw ValidationException::withMessages(['code' => 'That code is not right. Scan the QR code again, then type the 6 digits the app shows.']);
        }

        [$plain, $hashes] = $this->twoFactor->newRecoveryCodes();

        DB::transaction(function () use ($user, $saved, $hashes, $ip) {
            $user->forceFill([
                'two_factor_secret' => $saved['secret'],
                'two_factor_recovery_codes' => $hashes,
                'two_factor_confirmed_at' => now(),
                'two_factor_setup_deadline' => null,
            ])->save();
            $this->audit($user, 'two_factor_enabled', ['from' => 'account_settings'], $ip);
        });
        $session->forget(self::SESSION_KEY);

        return $plain;
    }

    /** @return array<int, string> */
    public function newRecoveryCodes(User $user, ?string $ip): array
    {
        if (! $user->hasTwoFactor()) {
            throw new ApiException('Turn on two-step sign-in first.', 'TWO_FACTOR_OFF', 409);
        }

        [$plain, $hashes] = $this->twoFactor->newRecoveryCodes();

        DB::transaction(function () use ($user, $hashes, $ip) {
            $user->forceFill(['two_factor_recovery_codes' => $hashes])->save();
            $this->audit($user, 'two_factor_recovery_codes_renewed', null, $ip);
        });

        return $plain;
    }

    public function disable(User $user, ?string $ip, ?string $device): void
    {
        if (! $user->hasTwoFactor()) {
            throw new ApiException('Two-step sign-in is already off.', 'TWO_FACTOR_OFF', 409);
        }
        if ($reason = self::whyCantTurnOff($user)) {
            throw new ApiException($reason, 'TWO_FACTOR_REQUIRED', 403);
        }

        DB::transaction(function () use ($user, $ip, $device) {
            $user->forceFill([
                'two_factor_secret' => null,
                'two_factor_recovery_codes' => null,
                'two_factor_confirmed_at' => null,
            ])->save();
            $this->audit($user, 'two_factor_disabled', null, $ip);

            // An account that runs the system just became easier to break into: the other owners should know
            if (in_array($user->role, ['admin', 'super_admin'], true)) {
                $this->raise->handle([
                    'type' => SecurityAlert::TYPE_TWO_FACTOR_OFF,
                    'severity' => 'medium',
                    'user_id' => $user->id,
                    'subject_email' => strtolower($user->email),
                    'ip_address' => $ip,
                    'device' => $device,
                ], 'Two-step sign-in turned off', "{$user->full_name} turned off two-step sign-in for their account.", [$user->id]);
            }
        });
    }

    private function audit(User $user, string $action, ?array $values, ?string $ip): void
    {
        AuditTrail::record([
            'user_id' => $user->id,
            'company_id' => $user->company_id,
            'action' => $action,
            'table_name' => 'users',
            'record_id' => $user->id,
            'new_values' => $values,
            'ip_address' => $ip,
        ]);
    }
}
