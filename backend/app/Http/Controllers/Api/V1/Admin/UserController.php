<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Domain\Identity\Actions\CreateUser;
use App\Domain\Identity\Support\EmployeeIdGenerator;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreUserRequest;
use App\Http\Resources\UserResource;
use Illuminate\Http\JsonResponse;

/**
 * Admin user management (Framer lmhV2DJV1, "Create user" modal).
 *
 *   GET  /api/v1/admin/users/next-employee-id   preview for the read-only field (nothing is reserved)
 *   POST /api/v1/admin/users                    create, 201 Created
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
}
