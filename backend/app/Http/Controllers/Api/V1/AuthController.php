<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Identity\Actions\AuthenticateUser;
use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Auth;

/**
 * Login / logout / "who am I?" for the React app (Sanctum SPA cookie login).
 *
 * The flow, in order:
 *   1. GET  /sanctum/csrf-cookie   React gets a CSRF cookie (anti-forgery token)
 *   2. POST /api/v1/auth/login     checks the password, starts a session cookie
 *   3. GET  /api/v1/auth/me        on every page load: "am I still logged in?"
 *   4. POST /api/v1/auth/logout    ends the session
 */
class AuthController extends Controller
{
    public function login(LoginRequest $request, AuthenticateUser $authenticate): UserResource
    {
        $user = $authenticate->handle(
            $request->validated('email'),
            $request->validated('password'),
            $request->boolean('remember'),
        );

        // New session ID after login, so an old (possibly stolen) ID becomes useless.
        // This blocks an attack called "session fixation".
        $request->session()->regenerate();

        return UserResource::make($this->withProfile($user));
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
