<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Audit\AuditTrail;
use App\Domain\Identity\Actions\AuthenticateUser;
use App\Domain\Identity\Support\AccountStanding;
use App\Domain\Identity\Support\PendingTwoFactorLogin;
use App\Domain\Identity\Support\TwoFactor;
use App\Exceptions\ApiException;
use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\TwoFactorCodeRequest;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * The second step of signing in (two-step sign-in), AFTER a correct password.
 * Public routes: the "half signed in" session (PendingTwoFactorLogin) is the proof.
 *
 *   POST /auth/two-factor/challenge  { code } or { recovery_code }   two-step is on
 *   GET  /auth/two-factor/setup      QR code + key to type by hand     two-step required, not set up
 *   POST /auth/two-factor/setup      { code }  → on, returns the backup codes ONCE
 *   POST /auth/two-factor/skip       "Set up later" (only inside the setup window)
 *   POST /auth/two-factor/cancel     back to the password
 */
class TwoFactorLoginController extends Controller
{
    public function __construct(private AuthenticateUser $authenticate, private TwoFactor $twoFactor) {}

    public function challenge(TwoFactorCodeRequest $request, AuthController $auth): JsonResponse
    {
        [$user, $pending] = $this->pending($request, 'challenge');

        $ok = $request->filled('recovery_code')
            ? $this->twoFactor->useRecoveryCode($user, $request->validated('recovery_code'))
            : $this->twoFactor->verify($user, $user->two_factor_secret, (string) $request->validated('code'));

        if (! $ok) {
            $this->audit($user, 'two_factor_failed', $request);
            throw ValidationException::withMessages([
                $request->filled('recovery_code') ? 'recovery_code' : 'code' => 'That code is not right. Check your authenticator app and try again.',
            ]);
        }

        if ($request->filled('recovery_code')) {
            $this->audit($user, 'two_factor_recovery_code_used', $request, ['codes_left' => count($user->fresh()->two_factor_recovery_codes ?? [])]);
        }

        return $this->complete($request, $auth, $user, $pending);
    }

    /** The QR code to scan. The key is made once per sign-in attempt and only saved after a correct code. */
    public function setupInfo(Request $request): JsonResponse
    {
        [$user, $pending] = $this->pending($request, 'setup');

        $secret = $pending['setup_secret'] ?? $this->twoFactor->newSecret();
        PendingTwoFactorLogin::rememberSetupSecret($request->session(), $secret);

        return response()->json(['data' => [
            ...AuthController::twoFactorStep($user, 'setup'),
            'qr_svg' => $this->twoFactor->qrSvg($user, $secret),
            'secret' => trim(chunk_split($secret, 4, ' ')), // grouped by 4 so it's easier to type
        ]]);
    }

    public function confirmSetup(TwoFactorCodeRequest $request, AuthController $auth): JsonResponse
    {
        [$user, $pending] = $this->pending($request, 'setup');
        $secret = $pending['setup_secret'] ?? throw new ApiException('Open the setup screen again to get a new QR code.', 'TWO_FACTOR_SETUP_EXPIRED', 409);

        if (! $this->twoFactor->verify($user, $secret, (string) $request->validated('code'))) {
            throw ValidationException::withMessages(['code' => 'That code is not right. Scan the QR code again, then type the 6 digits the app shows.']);
        }

        [$plainCodes, $hashes] = $this->twoFactor->newRecoveryCodes();

        DB::transaction(function () use ($user, $secret, $hashes, $request) {
            $user->forceFill([
                'two_factor_secret' => $secret,
                'two_factor_recovery_codes' => $hashes,
                'two_factor_confirmed_at' => now(),
                'two_factor_required_at' => null,
                'two_factor_setup_deadline' => null,
            ])->save();
            $this->audit($user, 'two_factor_enabled', $request);
        });

        $response = $this->complete($request, $auth, $user, $pending);
        $payload = $response->getData(true);
        $payload['meta'] = ['recovery_codes' => $plainCodes]; // shown ONCE, never again

        return response()->json($payload);
    }

    public function skip(Request $request, AuthController $auth): JsonResponse
    {
        [$user, $pending] = $this->pending($request, 'setup');

        if ($user->twoFactorSetupOverdue()) {
            throw new ApiException('The time to set up two-step sign-in has run out. Set it up now to continue.', 'TWO_FACTOR_SETUP_OVERDUE', 409);
        }

        $this->audit($user, 'two_factor_setup_postponed', $request, ['deadline' => $user->two_factor_setup_deadline?->toIso8601String()]);

        return $this->complete($request, $auth, $user, $pending);
    }

    public function cancel(Request $request): Response
    {
        PendingTwoFactorLogin::clear($request->session());

        return response()->noContent();
    }

    /**
     * The waiting user, checked again (they could have been deactivated in the meantime).
     *
     * @return array{0: User, 1: array<string, mixed>}
     */
    private function pending(Request $request, string $stage): array
    {
        $pending = PendingTwoFactorLogin::get($request->session());
        $user = $pending ? User::find($pending['user_id']) : null;

        if (! $user || $pending['stage'] !== $stage) {
            throw new ApiException('Your sign-in timed out. Enter your email and password again.', 'TWO_FACTOR_EXPIRED', 401);
        }
        if ($problem = AccountStanding::problem($user)) {
            PendingTwoFactorLogin::clear($request->session());
            throw $problem;
        }

        return [$user, $pending];
    }

    private function complete(Request $request, AuthController $auth, User $user, array $pending): JsonResponse
    {
        PendingTwoFactorLogin::clear($request->session());
        $this->authenticate->finish($user, (bool) $pending['remember'], $request->ip(), $request->userAgent());

        return $auth->signedIn($request, $user);
    }

    private function audit(User $user, string $action, Request $request, ?array $values = null): void
    {
        AuditTrail::record([
            'user_id' => $user->id,
            'company_id' => $user->company_id,
            'action' => $action,
            'table_name' => 'users',
            'record_id' => $user->id,
            'old_values' => null,
            'new_values' => $values === null ? null : json_encode($values),
            'ip_address' => $request->ip(),
            'user_agent' => null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
}
