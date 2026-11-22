<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Domain\Tenancy\Actions\CreateDepartment;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreDepartmentRequest;
use App\Http\Resources\Admin\DepartmentResource;
use Illuminate\Http\JsonResponse;

/** Admin departments. For now only "Add department" (Quick actions); the Departments page comes later. */
class DepartmentController extends Controller
{
    /** POST /api/v1/admin/departments -> 201 with the new department */
    public function store(StoreDepartmentRequest $request, CreateDepartment $create): JsonResponse
    {
        $department = $create->handle($request->validated(), $request->user(), $request->ip());

        return DepartmentResource::make($department)->response()->setStatusCode(201);
    }
}
