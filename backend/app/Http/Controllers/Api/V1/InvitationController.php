<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Identity\Actions\SendAccountInvitation;
use App\Domain\Identity\Actions\SendPasswordReset;
use App\Domain\Security\Actions\RaiseSecurityAlert;
use App\Exceptions\ApiException;
use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\AcceptInvitationRequest;
use App\Models\SecurityAlert;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Password;

/**
 * PUBLIC "set your password" endpoints, used by the link in the invitation email
 * AND by the "choose a new password" link a Super Admin sends (Reset password).
 * No sign-in needed: the one-time token in the link is the proof.
 *
 * Which kind of link it is follows from the account: a pending account (never set a password)
 * has an invitation link (72 h), an active one has a reset link (60 min).
 */
class InvitationController extends Controller
{
    /**
     * POST /api/v1/auth/invitation/check  { email, token }
     * Lets the page say "link expired" BEFORE someone types a password. Returns the first name for the greeting.
     */
    public function check(Request $request): JsonResponse
    {
        $user = $this->validUser($request->string('email'), $request->string('token'));

        return response()->json(['data' => [
            'first_name' => $user->first_name,
            'email' => $user->email,
            'kind' => $user->access_status === 'pending' ? 'invitation' : 'reset', // the page words its heading by this
        ]]);
    }

    /**
     * POST /api/v1/auth/invitation/accept  { email, token, password, password_confirmation }
     * Saves the password, activates the account, and uses up the token (the link stops working).
     */
    public function accept(AcceptInvitationRequest $request, RaiseSecurityAlert $raise): Response
    {
        $account = $this->validUser($request->validated('email'), $request->validated('token'));
        $isReset = $account->access_status !== 'pending';

        $status = Password::broker($this->brokerFor($account))->reset(
            $request->only('email', 'password', 'password_confirmation', 'token'),
            function (User $user, string $password) use ($request, $isReset, $raise) {
                DB::transaction(function () use ($user, $password, $request, $isReset, $raise) {
                    $user->forceFill(['password' => $password, 'access_status' => 'accepted'])->save();

                    DB::table('audit_logs')->insert([
                        'user_id' => $user->id,
                        'company_id' => $user->company_id,
                        'action' => $isReset ? 'password_reset_completed' : 'password_set',
                        'table_name' => 'users',
                        'record_id' => $user->id,
                        'old_values' => $isReset ? null : json_encode(['access_status' => 'pending']),
                        'new_values' => $isReset ? null : json_encode(['access_status' => 'accepted']),
                        'ip_address' => $request->ip(),
                        'user_agent' => null,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);

                    // A changed password on an account that runs the system is worth a (low) alert
                    if ($isReset && in_array($user->role, ['admin', 'super_admin'], true)) {
                        $raise->handle([
                            'type' => SecurityAlert::TYPE_PASSWORD_CHANGED,
                            'severity' => 'low',
                            'user_id' => $user->id,
                            'subject_email' => strtolower($user->email),
                            'ip_address' => $request->ip(),
                        ], 'Password was changed', "{$user->full_name} chose a new password using a reset link.", [$user->id]);
                    }
                });
            },
        );

        if ($status !== Password::PASSWORD_RESET) {
            throw $this->invalidLink();
        }

        return response()->noContent();
    }

    /** The account behind a link, if the link is still valid (right person, unused, not expired). */
    private function validUser(string $email, string $token): User
    {
        $user = User::where('email', $email)->first();

        if (! $user || $token === '' || ! Password::broker($this->brokerFor($user))->tokenExists($user, $token)) {
            throw $this->invalidLink();
        }

        return $user;
    }

    /** Invitation links last 72 h, reset links 60 min (config/auth.php "passwords"). */
    private function brokerFor(User $user): string
    {
        return $user->access_status === 'pending' ? SendAccountInvitation::BROKER : SendPasswordReset::BROKER;
    }

    private function invalidLink(): ApiException
    {
        return new ApiException(
            'This link has expired or was already used. Ask your Super Admin to send a new one.',
            'INVITATION_INVALID',
            410, // 410 Gone: the link existed but can't be used any more
        );
    }
}
