<?php

namespace App\Domain\Identity\Support;

use App\Models\User;
use BaconQrCode\Renderer\Image\SvgImageBackEnd;
use BaconQrCode\Renderer\ImageRenderer;
use BaconQrCode\Renderer\RendererStyle\RendererStyle;
use BaconQrCode\Writer;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use PragmaRX\Google2FA\Google2FA;

/**
 * TWO-STEP SIGN-IN (TOTP = "time-based one-time password").
 *
 * How it works, in plain words:
 *   1. At setup we make a random SECRET KEY and show it as a QR code.
 *   2. The person scans it with an authenticator app (Google Authenticator, Microsoft Authenticator…).
 *   3. From then on, the app and our server both calculate the same 6-digit code from
 *      (secret + current time), changing every 30 seconds. Nothing is sent between them.
 *   4. At sign-in, after the password, they type the code; we calculate it too and compare.
 *
 * Someone who steals the password still can't get in without the phone.
 * RECOVERY CODES are 8 one-time backup codes for a lost phone (stored hashed, like passwords).
 */
class TwoFactor
{
    /** Shown as the account name in the authenticator app. */
    private const ISSUER = 'AI Voucher Monitoring';

    private const RECOVERY_CODE_COUNT = 8;

    public function __construct(private Google2FA $google2fa) {}

    public function newSecret(): string
    {
        return $this->google2fa->generateSecretKey(32);
    }

    /** The QR code as an <svg> picture (made on the server, so the secret never goes to a third party). */
    public function qrSvg(User $user, string $secret): string
    {
        $url = $this->google2fa->getQRCodeUrl(self::ISSUER, $user->email, $secret);
        $writer = new Writer(new ImageRenderer(new RendererStyle(192, 1), new SvgImageBackEnd));

        return $writer->writeString($url);
    }

    /**
     * Is this 6-digit code right? Accepts the codes from 30 s before/after (phone clocks drift),
     * and never accepts the SAME code twice (someone looking over a shoulder can't reuse it).
     */
    public function verify(User $user, string $secret, string $code): bool
    {
        $code = preg_replace('/\D/', '', $code);
        if (strlen($code) !== 6) {
            return false;
        }

        $cacheKey = 'two-factor:last-timestamp:'.$user->id;
        $timestamp = $this->google2fa->verifyKeyNewer($secret, $code, Cache::get($cacheKey), 1);
        if ($timestamp === false) {
            return false;
        }

        Cache::put($cacheKey, $timestamp === true ? $this->google2fa->getTimestamp() : $timestamp, now()->addMinutes(5));

        return true;
    }

    /**
     * New backup codes. Returns [plain codes to show ONCE, hashes to store].
     *
     * @return array{0: array<int, string>, 1: array<int, string>}
     */
    public function newRecoveryCodes(): array
    {
        $plain = collect(range(1, self::RECOVERY_CODE_COUNT))
            ->map(fn () => Str::lower(Str::random(5)).'-'.Str::lower(Str::random(5)))
            ->all();

        return [$plain, array_map(fn ($code) => Hash::make($code), $plain)];
    }

    /** Uses up one backup code (it can't be used again). */
    public function useRecoveryCode(User $user, string $code): bool
    {
        $code = Str::lower(trim($code));
        $hashes = $user->two_factor_recovery_codes ?? [];

        foreach ($hashes as $i => $hash) {
            if (Hash::check($code, $hash)) {
                unset($hashes[$i]);
                $user->forceFill(['two_factor_recovery_codes' => array_values($hashes)])->save();

                return true;
            }
        }

        return false;
    }
}
