<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Identity\Actions\SendAccountInvitation;
use App\Exceptions\ApiException;
use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\AcceptInvitationRequest;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Password;

/**
 * PUBLIC "set your password" endpoints, used by the link in the invitation email.
 * No sign-in needed: the one-time token in the link is the proof.
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

        return response()->json(['data' => ['first_name' => $user->first_name, 'email' => $user->email]]);
    }

    /**
     * POST /api/v1/auth/invitation/accept  { email, token, password, password_confirmation }
     * Saves the password, activates the account, and uses up the token (the link stops working).
     */
    public function accept(AcceptInvitationRequest $request): Response
    {
        $this->validUser($request->validated('email'), $request->validated('token'));

        $status = Password::broker(SendAccountInvitation::BROKER)->reset(
            $request->only('email', 'password', 'password_confirmation', 'token'),
            function (User $user, string $password) use ($request) {
                DB::transaction(function () use ($user, $password, $request) {
                    $user->forceFill(['password' => $password, 'access_status' => 'accepted'])->save();

                    DB::table('audit_logs')->insert([
                        'user_id' => $user->id,
                        'company_id' => $user->company_id,
                        'action' => 'password_set',
                        'table_name' => 'users',
                        'record_id' => $user->id,
                        'old_values' => json_encode(['access_status' => 'pending']),
                        'new_values' => json_encode(['access_status' => 'accepted']),
                        'ip_address' => $request->ip(),
                        'user_agent' => null,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
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

        if (! $user || $token === '' || ! Password::broker(SendAccountInvitation::BROKER)->tokenExists($user, $token)) {
            throw $this->invalidLink();
        }

        return $user;
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
