<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Identity\Account\AccountOverview;
use App\Domain\Identity\Account\ChangeOwnPassword;
use App\Domain\Identity\Account\OwnActivity;
use App\Domain\Identity\Account\OwnSessions;
use App\Domain\Identity\Account\OwnTwoFactor;
use App\Domain\Identity\Account\SupportContacts;
use App\Domain\Identity\Account\UpdateOwnProfile;
use App\Domain\Security\Support\DeviceLabel;
use App\Http\Controllers\Controller;
use App\Http\Requests\Account\AccountActivityRequest;
use App\Http\Requests\Account\ChangePasswordRequest;
use App\Http\Requests\Account\ConfirmPasswordRequest;
use App\Http\Requests\Account\EnableTwoFactorRequest;
use App\Http\Requests\Account\UpdateProfileRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

/**
 * The account menu pages (My profile, Account settings, Change password, My activity, Help & support).
 * SELF-SERVICE: every route works on the signed-in person's own account. There is no {user} in the
 * address, so nobody can reach someone else's account by changing a number.
 *
 *   GET    /account                       profile + security summary
 *   PATCH  /account                       name / personal email
 *   PUT    /account/password              change password (signs out other browsers)
 *   GET    /account/two-factor/setup      QR code to turn two-step on
 *   POST   /account/two-factor            { code } → on + backup codes (once)
 *   POST   /account/two-factor/recovery-codes  { password } → new backup codes
 *   DELETE /account/two-factor            { password } → off (unless required)
 *   GET    /account/sessions              where you're signed in
 *   DELETE /account/sessions/{key}        sign out one other browser
 *   POST   /account/sessions/sign-out-others
 *   GET    /account/activity              your audit log entries
 *   GET    /account/support               who can help you
 */
class AccountController extends Controller
{
    public function show(Request $request, AccountOverview $overview): JsonResponse
    {
        return response()->json(['data' => $overview->for($request->user(), $this->sessionId($request))]);
    }

    public function update(UpdateProfileRequest $request, UpdateOwnProfile $update, AccountOverview $overview): JsonResponse
    {
        $changed = $update->handle($request->user(), $request->changes(), $request->was(), $request->ip(), DeviceLabel::from($request->userAgent()));

        return response()->json([
            'data' => $overview->for($request->user(), $this->sessionId($request)),
            'meta' => ['changed' => $changed],
        ]);
    }

    public function changePassword(ChangePasswordRequest $request, ChangeOwnPassword $change): JsonResponse
    {
        $user = $request->user();
        $signedOut = $change->handle($user, $request->validated('password'), $this->sessionId($request), $request->ip(), DeviceLabel::from($request->userAgent()));

        // A fresh session ID after a password change (an old copied ID stops working too).
        // Sanctum stores the new password's fingerprint in this session at the end of the request.
        if ($request->hasSession()) {
            $request->session()->regenerate(true); // true = delete the old session row too
        }

        return response()->json(['data' => ['other_sessions_signed_out' => $signedOut]]);
    }

    public function twoFactorSetup(Request $request, OwnTwoFactor $twoFactor): JsonResponse
    {
        return response()->json(['data' => $twoFactor->setup($request->user(), $request->session())]);
    }

    public function enableTwoFactor(EnableTwoFactorRequest $request, OwnTwoFactor $twoFactor, AccountOverview $overview): JsonResponse
    {
        $codes = $twoFactor->enable($request->user(), $request->session(), (string) $request->validated('code'), $request->ip());

        return response()->json([
            'data' => $overview->for($request->user(), $this->sessionId($request)),
            'meta' => ['recovery_codes' => $codes], // shown ONCE, never again
        ]);
    }

    public function newRecoveryCodes(ConfirmPasswordRequest $request, OwnTwoFactor $twoFactor): JsonResponse
    {
        return response()->json(['data' => ['recovery_codes' => $twoFactor->newRecoveryCodes($request->user(), $request->ip())]]);
    }

    public function disableTwoFactor(ConfirmPasswordRequest $request, OwnTwoFactor $twoFactor, AccountOverview $overview): JsonResponse
    {
        $twoFactor->disable($request->user(), $request->ip(), DeviceLabel::from($request->userAgent()));

        return response()->json(['data' => $overview->for($request->user(), $this->sessionId($request))]);
    }

    public function sessions(Request $request, OwnSessions $sessions): JsonResponse
    {
        return response()->json(['data' => $sessions->list($request->user(), $this->sessionId($request))]);
    }

    public function signOutSession(Request $request, string $key, OwnSessions $sessions): Response
    {
        $sessions->signOut($request->user(), $key, $this->sessionId($request), $request->ip());

        return response()->noContent();
    }

    public function signOutOthers(Request $request, OwnSessions $sessions): JsonResponse
    {
        $count = $sessions->signOutOthers($request->user(), $this->sessionId($request), $request->ip());

        return response()->json(['data' => ['signed_out' => $count]]);
    }

    public function activity(AccountActivityRequest $request, OwnActivity $activity): JsonResponse
    {
        return response()->json($activity->page(
            $request->user(),
            $request->validated('type', 'all'),
            (int) $request->validated('page', 1),
        ));
    }

    public function support(Request $request, SupportContacts $contacts): JsonResponse
    {
        return response()->json(['data' => [
            'contacts' => $contacts->for($request->user()),
            'request_id' => $request->attributes->get('request_id'),
        ]]);
    }

    private function sessionId(Request $request): string
    {
        return $request->hasSession() ? $request->session()->getId() : '';
    }
}
