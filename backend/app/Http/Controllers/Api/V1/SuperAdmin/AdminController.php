<?php

namespace App\Http\Controllers\Api\V1\SuperAdmin;

use App\Domain\Identity\Actions\CreateAdmin;
use App\Domain\Identity\Actions\LockAdminAccount;
use App\Domain\Identity\Actions\SendAccountInvitation;
use App\Domain\Identity\Actions\SendPasswordReset;
use App\Domain\Identity\Actions\UnlockAdminAccount;
use App\Domain\Identity\Support\EmployeeIdGenerator;
use App\Exceptions\ApiException;
use App\Http\Controllers\Controller;
use App\Http\Requests\SuperAdmin\AdminAccountActionRequest;
use App\Http\Requests\SuperAdmin\LockAdminRequest;
use App\Http\Requests\SuperAdmin\StoreAdminRequest;
use App\Http\Resources\UserResource;
use App\Models\Company;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Admin accounts, managed by the Super Admin (Framer TkIHF89oH "Create admin account").
 */
class AdminController extends Controller
{
    /**
     * GET /api/v1/superadmin/admins/form-defaults
     * The next Employee ID (a preview, nothing is reserved) and the companies an Admin can be
     * given: active and not suspended, each with how many Admins it already has.
     */
    public function formDefaults(EmployeeIdGenerator $employeeIds): JsonResponse
    {
        $companies = Company::where('is_active', true)->whereNull('suspended_at')
            ->withCount(['users as admins_count' => fn ($q) => $q->where('role', 'admin')])
            ->orderBy('name')
            ->get(['id', 'name']);

        return response()->json(['data' => [
            'employee_id' => $employeeIds->peek(),
            'companies' => $companies->map(fn (Company $c) => [
                'id' => $c->id, 'name' => $c->name, 'admins_count' => $c->admins_count,
            ])->values(),
        ]]);
    }

    /** POST /api/v1/superadmin/admins -> 201 with the new Admin + whether the invitation email went out */
    public function store(StoreAdminRequest $request, CreateAdmin $createAdmin): JsonResponse
    {
        $result = $createAdmin->handle(
            [...$request->safe()->only(['first_name', 'last_name', 'personal_email', 'company_id']), 'email' => $request->email()],
            $request->user(),
            $request->ip(),
            $request->userAgent(),
        );

        return UserResource::make($result['admin']->load('company'))
            ->additional(['meta' => ['invitation_sent' => $result['invitation_sent']]])
            ->response()
            ->setStatusCode(201);
    }

    /**
     * POST /api/v1/superadmin/admins/{user}/invitation: send a NEW set-password link
     * (the old link stops working). Only for Admins who haven't set their password yet.
     */
    public function resendInvitation(Request $request, User $user, SendAccountInvitation $invitation): JsonResponse
    {
        if ($user->role !== 'admin') {
            throw new ApiException('We could not find what you are looking for.', 'NOT_FOUND', 404);
        }
        if ($user->access_status !== 'pending') {
            throw new ApiException('This Admin has already set a password.', 'ALREADY_ACTIVE', 409);
        }
        if (! $user->personal_email) {
            throw new ApiException('This Admin has no personal email to send the link to.', 'NO_PERSONAL_EMAIL', 409);
        }
        if (! $invitation->handle($user, $request->user(), $request->ip())) {
            throw new ApiException('The email could not be sent. Please try again in a moment.', 'EMAIL_NOT_SENT', 503);
        }

        return response()->json(['data' => ['sent_to' => $user->personal_email]]);
    }

    /** POST /api/v1/superadmin/admins/{user}/lock  { password, security_alert_id? } (Alert detail, SCoT_cu7B) */
    public function lock(LockAdminRequest $request, User $user, LockAdminAccount $lock): UserResource
    {
        $this->mustBeAdmin($user);

        return UserResource::make($lock->handle($user, $request->user(), $request->validated('security_alert_id'), $request->ip()));
    }

    /** POST /api/v1/superadmin/admins/{user}/unlock */
    public function unlock(AdminAccountActionRequest $request, User $user, UnlockAdminAccount $unlock): UserResource
    {
        $this->mustBeAdmin($user);

        return UserResource::make($unlock->handle($user, $request->user(), $request->ip()));
    }

    /**
     * POST /api/v1/superadmin/admins/{user}/password-reset  { security_alert_id? }
     * Emails a 60-minute "choose a new password" link and stops the old password working.
     */
    public function passwordReset(AdminAccountActionRequest $request, User $user, SendPasswordReset $reset): JsonResponse
    {
        $this->mustBeAdmin($user);

        $sentTo = $reset->handle($user, $request->user(), $request->validated('security_alert_id'), $request->ip());

        return response()->json(['data' => ['sent_to' => $sentTo]]);
    }

    /** Only Admin accounts are managed here; anything else looks like it doesn't exist (404). */
    private function mustBeAdmin(User $user): void
    {
        if ($user->role !== 'admin') {
            throw new ApiException('We could not find what you are looking for.', 'NOT_FOUND', 404);
        }
    }
}
