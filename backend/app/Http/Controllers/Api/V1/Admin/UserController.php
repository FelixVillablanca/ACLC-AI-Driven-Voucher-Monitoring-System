<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Domain\Identity\Actions\CreateUser;
use App\Domain\Identity\CompanyUsers\SetCompanyUserPassword;
use App\Domain\Identity\CompanyUsers\SetCompanyUserStatus;
use App\Domain\Identity\CompanyUsers\UpdateCompanyUser;
use App\Domain\Identity\Queries\CompanyUserDirectory;
use App\Domain\Identity\Support\EmployeeIdGenerator;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\DepartmentStatusRequest;
use App\Http\Requests\Admin\ListCompanyUsersRequest;
use App\Http\Requests\Admin\SetCompanyUserPasswordRequest;
use App\Http\Requests\Admin\StoreUserRequest;
use App\Http\Requests\Admin\UpdateCompanyUserRequest;
use App\Http\Resources\Admin\CompanyUserResource;
use App\Http\Resources\UserResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * Admin user management (Framer lmhV2DJV1, "Create user" modal).
 *
 *   GET  /api/v1/admin/users/next-employee-id   preview for the read-only field (nothing is reserved)
 *   POST /api/v1/admin/users                    create, 201 Created
 * People & Access -> Users page (code-first 2026-11-22), only the Admin's own company's
 * clerks / officers / supervisors (any other id = 404):
 *   GET   /admin/users  ·  GET /admin/users/{id}  ·  PATCH /admin/users/{id}
 *   POST  /admin/users/{id}/deactivate|reactivate  ·  POST /admin/users/{id}/password
 */
class UserController extends Controller
{
    public function nextEmployeeId(EmployeeIdGenerator $employeeIds): JsonResponse
    {
        return response()->json(['data' => ['employee_id' => $employeeIds->peek()]]);
    }

    public function store(StoreUserRequest $request, CreateUser $createUser): JsonResponse
    {
        // The email is built on the server (name + the role's domain), never taken from the browser
        // ...and the company is always the Admin's own one (CreateUser checks it's active)
        $data = [...$request->validated(), 'email' => $request->email()];
        $user = $createUser->handle($data, $request->user(), $request->ip(), $request->userAgent());

        return UserResource::make($user->load(['company', 'department', 'accessibleCompanies']))
            ->response()
            ->setStatusCode(201);
    }

    /** GET /api/v1/admin/users  meta.views = tab numbers (follow the filters), meta.summary = the cards */
    public function index(ListCompanyUsersRequest $request): AnonymousResourceCollection
    {
        $directory = $this->directory($request);
        $search = $request->validated('search');
        $role = $request->validated('filter.role');
        $department = $request->validated('filter.department');

        $page = $directory->sort(
            $directory->withRowData($directory->filter($directory->base($search), $request->validated('filter.view'), $role, $department)),
            $request->validated('sort'),
        )->paginate((int) $request->validated('per_page', 20))->withQueryString();

        return CompanyUserResource::collection($page)->additional(['meta' => [
            'views' => $directory->viewCounts($search, $role, $department),
            'summary' => $directory->summary(),
        ]]);
    }

    /** GET /api/v1/admin/users/{user}  (side panel) */
    public function show(Request $request, int $user): CompanyUserResource
    {
        return CompanyUserResource::make($this->directory($request)->find($user));
    }

    /** PATCH /api/v1/admin/users/{user} -> the person + meta.changed + meta.signed_out (true after a role change) */
    public function update(UpdateCompanyUserRequest $request, int $user, UpdateCompanyUser $update): CompanyUserResource
    {
        $directory = $this->directory($request);
        $result = $update->handle(
            $directory->find($user),
            $request->safe()->only(['first_name', 'last_name', 'role', 'department_id']),
            $request->validated('updated_at'),
            $request->user(),
            $request->ip(),
        );

        return CompanyUserResource::make($directory->find($result['user']->id))
            ->additional(['meta' => ['changed' => $result['changed'], 'signed_out' => $result['signed_out']]]);
    }

    /** POST /api/v1/admin/users/{user}/deactivate  { reason? } */
    public function deactivate(DepartmentStatusRequest $request, int $user, SetCompanyUserStatus $status): CompanyUserResource
    {
        $directory = $this->directory($request);
        $status->handle($directory->find($user), false, $request->validated('reason'), $request->user(), $request->ip());

        return CompanyUserResource::make($directory->find($user));
    }

    /** POST /api/v1/admin/users/{user}/reactivate */
    public function reactivate(DepartmentStatusRequest $request, int $user, SetCompanyUserStatus $status): CompanyUserResource
    {
        $directory = $this->directory($request);
        $status->handle($directory->find($user), true, null, $request->user(), $request->ip());

        return CompanyUserResource::make($directory->find($user));
    }

    /** POST /api/v1/admin/users/{user}/password  { password } -> 200; the person is signed out everywhere */
    public function password(SetCompanyUserPasswordRequest $request, int $user, SetCompanyUserPassword $set): CompanyUserResource
    {
        $directory = $this->directory($request);
        $set->handle($directory->find($user), $request->validated('password'), $request->user(), $request->ip());

        return CompanyUserResource::make($directory->find($user));
    }

    private function directory(Request $request): CompanyUserDirectory
    {
        return new CompanyUserDirectory((int) ($request->user()->company_id ?? 0));
    }
}
