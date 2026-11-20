<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Identity\Actions\AuthenticateUser;
use App\Domain\Identity\Support\PendingTwoFactorLogin;
use App\Http\Controllers\Controller;
use App\Http\Middleware\EnforceIdleTimeout;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Auth;

/**
 * Login / logout / "who am I?" for the React app (Sanctum SPA cookie login).
 *
 * The flow, in order:
 *   1. GET  /sanctum/csrf-cookie   React gets a CSRF cookie (anti-forgery token)
 *   2. POST /api/v1/auth/login     checks the password, starts a session cookie
 *                                  (or, with two-step on, asks for the code first: TwoFactorLoginController)
 *   3. GET  /api/v1/auth/me        on every page load: "am I still logged in?"
 *   4. POST /api/v1/auth/logout    ends the session
 */
class AuthController extends Controller
{
    /**
     * 200 { data: user }                                  signed in
     * 200 { data: { two_factor: { stage, can_skip, setup_deadline } } }   password OK, now the code / the setup
     */
    public function login(LoginRequest $request, AuthenticateUser $authenticate): JsonResponse
    {
        $result = $authenticate->check(
            $request->validated('email'),
            $request->validated('password'),
            $request->ip(),
            $request->userAgent(),
        );
        $user = $result['user'];

        if ($result['two_factor']) {
            // NOT signed in yet: remember who is waiting for which step (10 minutes)
            PendingTwoFactorLogin::start($request->session(), $user, $request->boolean('remember'), $result['two_factor']);

            return response()->json(['data' => ['two_factor' => self::twoFactorStep($user, $result['two_factor'])]]);
        }

        $authenticate->finish($user, $request->boolean('remember'), $request->ip(), $request->userAgent());

        return $this->signedIn($request, $user);
    }

    /** What the two-step screen needs to know. can_skip = still inside the setup window. */
    public static function twoFactorStep(User $user, string $stage): array
    {
        return [
            'stage' => $stage,
            'email' => $user->email,
            'can_skip' => $stage === 'setup' && ! $user->twoFactorSetupOverdue(),
            'setup_deadline' => $stage === 'setup' ? $user->two_factor_setup_deadline?->toIso8601String() : null,
        ];
    }

    /** The last part of every successful sign-in (password only, or password + code). */
    public function signedIn(Request $request, User $user): JsonResponse
    {
        // New session ID after login, so an old (possibly stolen) ID becomes useless.
        // This blocks an attack called "session fixation".
        $request->session()->regenerate();
        // Start the idle clock fresh (EnforceIdleTimeout), so an old value can't sign them straight out
        $request->session()->put(EnforceIdleTimeout::SESSION_KEY, now()->timestamp);

        return UserResource::make($this->withProfile($user))->response();
    }

    public function me(Request $request): UserResource
    {
        return UserResource::make($this->withProfile($request->user()));
    }

    public function logout(Request $request): Response
    {
        Auth::guard('web')->logout();
        $request->session()->invalidate();      // throw the session away
        $request->session()->regenerateToken(); // and issue a fresh CSRF token

        return response()->noContent(); // 204 = "done, nothing to send back"
    }

    /** Load what the app needs right after login (eager loading = fewer database queries). */
    private function withProfile(User $user): User
    {
        return $user->load([
            'company',
            'department',
            'accessibleCompanies' => fn ($query) => $query
                ->wherePivot('granted_status', 'accepted')
                ->where('companies.is_active', true)
                ->orderBy('companies.name'),
        ]);
    }
}
