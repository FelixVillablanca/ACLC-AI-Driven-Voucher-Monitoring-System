<?php

namespace App\Http\Controllers\Api\V1\SuperAdmin;

use App\Domain\Audit\AuditDescriber;
use App\Domain\Identity\Actions\CancelInvitation;
use App\Domain\Identity\Actions\CreateAdmin;
use App\Domain\Identity\Actions\DeactivateAccount;
use App\Domain\Identity\Actions\PromoteToSuperAdmin;
use App\Domain\Identity\Actions\ReactivateAccount;
use App\Domain\Identity\Actions\RequireTwoFactor;
use App\Domain\Identity\Actions\SendAccountInvitation;
use App\Domain\Identity\Actions\SendPasswordReset;
use App\Domain\Identity\Actions\UpdateAdmin;
use App\Domain\Identity\Queries\AdminDirectory;
use App\Domain\Identity\Support\AccountActions;
use App\Domain\Identity\Support\AdminExport;
use App\Domain\Identity\Support\EmployeeIdGenerator;
use App\Domain\Security\Support\OwnerActivity;
use App\Exceptions\ApiException;
use App\Http\Controllers\Controller;
use App\Http\Requests\SuperAdmin\AdminAccountActionRequest;
use App\Http\Requests\SuperAdmin\BulkAdminActionRequest;
use App\Http\Requests\SuperAdmin\DeactivateAccountRequest;
use App\Http\Requests\SuperAdmin\ExportAdminsRequest;
use App\Http\Requests\SuperAdmin\ListAdminsRequest;
use App\Http\Requests\SuperAdmin\PasswordConfirmRequest;
use App\Http\Requests\SuperAdmin\PasswordResetRequest;
use App\Http\Requests\SuperAdmin\RequireTwoFactorRequest;
use App\Http\Requests\SuperAdmin\StoreAdminRequest;
use App\Http\Requests\SuperAdmin\UpdateAdminRequest;
use App\Http\Resources\AdminAccountDetailResource;
use App\Http\Resources\AdminAccountResource;
use App\Http\Resources\UserResource;
use App\Models\Company;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;

/**
 * Admin and Super Admin accounts, managed by the Super Admin: the Admins tab (Framer U7glXUOSF)
 * and its click-flows A1–A12, plus Create admin (TkIHF89oH).
 * Every action checks the shared rules first (App\Domain\Identity\Support\AccountActions).
 */
class AdminController extends Controller
{
    public function __construct(private AdminDirectory $directory) {}

    /**
     * GET /api/v1/superadmin/admins
     * OFFSET pagination (page numbers), because this is a table with "Page 1 of 3".
     * meta.views = the numbers on the view tabs (they follow the search); meta.summary = the 4 cards.
     */
    public function index(ListAdminsRequest $request): AnonymousResourceCollection
    {
        $search = $request->validated('search');

        $accounts = $this->directory->sort(
            $this->directory->view($this->directory->base($search), $request->validated('filter.view')),
            $request->validated('sort', 'last_sign_in'),
            $request->validated('order', 'desc'),
        )->with('company:id,name')
            ->paginate((int) $request->validated('per_page', 25))
            ->withQueryString();

        return AdminAccountResource::collection($accounts)->additional(['meta' => [
            'views' => $this->directory->viewCounts($search),
            'summary' => $this->directory->summary(),
        ]]);
    }

    /** GET /api/v1/superadmin/admins/{user}  (profile panel A8, and the Edit / Make Super Admin dialogs) */
    public function show(User $user): AdminAccountDetailResource
    {
        $this->managed($user);

        return AdminAccountDetailResource::make($user->load('company:id,name'));
    }

    /** GET /api/v1/superadmin/admins/{user}/activity?page=2  (profile "Activity" tab: what THEY did) */
    public function activity(User $user, AuditDescriber $describer): JsonResponse
    {
        $this->managed($user);
        $page = DB::table('audit_logs')->where('user_id', $user->id)->orderByDesc('id')->paginate(20);

        return response()->json([
            'data' => $describer->describeMany(collect($page->items())),
            'meta' => ['current_page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'total' => $page->total()],
        ]);
    }

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

    /** PATCH /api/v1/superadmin/admins/{user}  (Edit details A9) */
    public function update(UpdateAdminRequest $request, User $user, UpdateAdmin $update): AdminAccountDetailResource
    {
        $this->managed($user);
        $result = $update->handle($user, $request->adminValues(), $request->user(), $request->ip());

        return AdminAccountDetailResource::make($result['admin']->load('company:id,name'))
            ->additional(['meta' => ['changed' => $result['changed'], 'invitation_resent' => $result['invitation_resent']]]);
    }

    /**
     * POST /api/v1/superadmin/admins/{user}/invitation: send a NEW set-password link
     * (the old link stops working). Only for Admins who haven't set their password yet.
     */
    public function resendInvitation(Request $request, User $user, SendAccountInvitation $invitation): JsonResponse
    {
        AccountActions::authorize($request->user(), $user, 'resend_invitation');

        if (! $invitation->handle($user, $request->user(), $request->ip())) {
            throw new ApiException('The email could not be sent. Please try again in a moment.', 'EMAIL_NOT_SENT', 503);
        }

        return response()->json(['data' => ['sent_to' => $user->personal_email]]);
    }

    /** DELETE /api/v1/superadmin/admins/{user}/invitation  (Cancel invite A5: deletes the never-used account) */
    public function cancelInvitation(Request $request, User $user, CancelInvitation $cancel): Response
    {
        $cancel->handle($user, $request->user(), $request->ip());

        return response()->noContent();
    }

    /** POST /api/v1/superadmin/admins/{user}/password-reset  { sign_out?, security_alert_id? } (A10) */
    public function passwordReset(PasswordResetRequest $request, User $user, SendPasswordReset $reset): JsonResponse
    {
        $this->managed($user);
        $sentTo = $reset->handle($user, $request->user(), $request->validated('security_alert_id'), $request->ip(), $request->boolean('sign_out', true));

        return response()->json(['data' => ['sent_to' => $sentTo]]);
    }

    /** POST /api/v1/superadmin/admins/{user}/two-factor  { setup_days, email_steps } (A11) */
    public function requireTwoFactor(RequireTwoFactorRequest $request, User $user, RequireTwoFactor $require): JsonResponse
    {
        $this->managed($user);
        $emailed = $require->handle($user, $request->user(), (int) $request->validated('setup_days'), $request->boolean('email_steps'), $request->ip());

        return response()->json(['data' => [
            'setup_deadline' => $user->fresh()->two_factor_setup_deadline?->toIso8601String(),
            'emailed' => $emailed,
            'sent_to' => $emailed ? $user->personal_email : null,
        ]]);
    }

    /** POST /api/v1/superadmin/admins/{user}/deactivate  { password, security_alert_id? } */
    public function deactivate(DeactivateAccountRequest $request, User $user, DeactivateAccount $deactivate): AdminAccountResource
    {
        $this->managed($user);

        return AdminAccountResource::make($deactivate->handle($user, $request->user(), $request->validated('security_alert_id'), $request->ip()));
    }

    /** POST /api/v1/superadmin/admins/{user}/reactivate */
    public function reactivate(AdminAccountActionRequest $request, User $user, ReactivateAccount $reactivate): AdminAccountResource
    {
        $this->managed($user);

        return AdminAccountResource::make($reactivate->handle($user, $request->user(), $request->ip()));
    }

    /** POST /api/v1/superadmin/admins/{user}/promote  { password }  (Make Super Admin A12) */
    public function promote(PasswordConfirmRequest $request, User $user, PromoteToSuperAdmin $promote): AdminAccountResource
    {
        $this->managed($user);

        return AdminAccountResource::make($promote->handle($user, $request->user(), $request->ip()));
    }

    /** GET /api/v1/superadmin/admins/export  → a .csv or .pdf file (A1). Every export is audited. */
    public function export(ExportAdminsRequest $request, AdminExport $export): Response
    {
        $query = $this->directory->base($request->validated('accounts') === 'view' ? $request->validated('search') : null);
        match ($request->validated('accounts')) {
            'view' => $this->directory->view($query, $request->validated('filter.view')),
            'selected' => $query->whereIn('id', $request->validated('ids')),
            default => $query,
        };
        $accounts = $this->directory->sort($query)->with('company:id,name')->get();
        $columns = array_values(array_unique($request->validated('columns')));

        [$headers, $rows] = $export->table($accounts, $columns);
        $format = $request->validated('format');
        $file = 'admin-list-'.now()->format('Y-m-d').'.'.$format;

        OwnerActivity::audit($request->user(), 'admins_exported', 'users', null, null,
            ['format' => $format, 'count' => count($rows), 'columns' => $columns, 'accounts' => $request->validated('accounts')], $request->ip());

        return response($format === 'csv' ? $export->csv($headers, $rows) : $export->pdf($headers, $rows, $request->user()), 200, [
            'Content-Type' => $format === 'csv' ? 'text/csv; charset=UTF-8' : 'application/pdf',
            'Content-Disposition' => 'attachment; filename="'.$file.'"',
            'Cache-Control' => 'no-store', // personal data: don't keep copies in browser/proxy caches
        ]);
    }

    /**
     * POST /api/v1/superadmin/admins/bulk  (the "2 selected" bar, A6)
     * Runs the action for each account; one that isn't allowed doesn't stop the others.
     * → { data: [{ id, name, ok, message }], meta: { done, skipped } }
     */
    public function bulk(
        BulkAdminActionRequest $request,
        SendPasswordReset $reset,
        RequireTwoFactor $require,
        DeactivateAccount $deactivate,
    ): JsonResponse {
        $by = $request->user();
        $results = [];

        foreach (User::whereIn('id', $request->validated('ids'))->orderBy('first_name')->get() as $user) {
            try {
                AccountActions::authorize($by, $user, match ($request->validated('action')) {
                    'password_reset' => 'reset_password',
                    'require_two_factor' => 'require_two_factor',
                    'deactivate' => 'deactivate',
                });
                match ($request->validated('action')) {
                    'password_reset' => $reset->handle($user, $by, null, $request->ip(), $request->boolean('sign_out', true)),
                    'require_two_factor' => $require->handle($user, $by, (int) $request->validated('setup_days'), $request->boolean('email_steps'), $request->ip()),
                    'deactivate' => $deactivate->handle($user, $by, null, $request->ip()),
                };
                $results[] = ['id' => $user->id, 'name' => $user->full_name, 'ok' => true, 'message' => null];
            } catch (ApiException $e) {
                $results[] = ['id' => $user->id, 'name' => $user->full_name, 'ok' => false, 'message' => $e->getMessage()];
            }
        }

        $done = count(array_filter($results, fn ($r) => $r['ok']));

        return response()->json(['data' => $results, 'meta' => ['done' => $done, 'skipped' => count($results) - $done]]);
    }

    /** Only Admin and Super Admin accounts are managed here; anything else looks like it doesn't exist (404). */
    private function managed(User $user): void
    {
        if (! in_array($user->role, AdminDirectory::ROLES, true)) {
            throw new ApiException('We could not find what you are looking for.', 'NOT_FOUND', 404);
        }
    }
}
