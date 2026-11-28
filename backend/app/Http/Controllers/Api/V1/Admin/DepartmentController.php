<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Domain\Tenancy\Actions\CreateDepartment;
use App\Domain\Tenancy\Actions\ManageDepartmentPeople;
use App\Domain\Tenancy\Actions\SetDepartmentStatus;
use App\Domain\Tenancy\Actions\UpdateDepartment;
use App\Domain\Tenancy\Queries\DepartmentDirectory;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\AddDepartmentPeopleRequest;
use App\Http\Requests\Admin\DepartmentStatusRequest;
use App\Http\Requests\Admin\ListDepartmentsRequest;
use App\Http\Requests\Admin\SetDepartmentHeadRequest;
use App\Http\Requests\Admin\StoreDepartmentRequest;
use App\Http\Requests\Admin\UpdateDepartmentRequest;
use App\Http\Resources\Admin\DepartmentMemberResource;
use App\Http\Resources\Admin\DepartmentResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * Organization → Departments (code-first 2026-11-22) + Quick actions "Add department".
 * Everything is the Admin's OWN company: another company's department id answers 404.
 */
class DepartmentController extends Controller
{
    /** GET /api/v1/admin/departments  meta.views = tab numbers (follow the search), meta.summary = the 4 cards */
    public function index(ListDepartmentsRequest $request): AnonymousResourceCollection
    {
        $directory = $this->directory($request);
        $search = $request->validated('search');

        $page = $directory->sort(
            $directory->withRowData($directory->view($directory->base($search), $request->validated('filter.view'))),
            $request->validated('sort'),
        )->paginate((int) $request->validated('per_page', 20))->withQueryString();

        return DepartmentResource::collection($page)->additional(['meta' => [
            'views' => $directory->viewCounts($search),
            'summary' => $directory->summary(),
        ]]);
    }

    /** GET /api/v1/admin/departments/{department}  (side panel) */
    public function show(Request $request, int $department): DepartmentResource
    {
        $directory = $this->directory($request);
        $row = $directory->withRowData($directory->base()->whereKey($directory->find($department)->id))->firstOrFail();

        return DepartmentResource::make($row);
    }

    /** GET /api/v1/admin/departments/{department}/members?page=  (side panel: the people, A–Z) */
    public function members(Request $request, int $department): AnonymousResourceCollection
    {
        $directory = $this->directory($request);
        $found = $directory->find($department);

        return DepartmentMemberResource::collection($directory->members($found))
            ->additional(['meta' => ['head_user_id' => $found->head_user_id]]);
    }

    /**
     * GET /api/v1/admin/departments/{department}/candidates?search=  (the "Add people" picker, 2026-11-28)
     * -> { data: [{ id, full_name, email, role, department: {id, name} | null, heads_department }], meta: { company_users } }
     */
    public function candidates(Request $request, int $department): JsonResponse
    {
        $directory = $this->directory($request);
        $found = $directory->find($department);
        $search = is_string($request->query('search')) ? mb_substr(trim($request->query('search')), 0, 100) : '';

        return response()->json([
            'data' => $directory->candidates($found, $search === '' ? null : $search)->map(fn ($u) => [
                'id' => $u->id,
                'full_name' => $u->full_name,
                'email' => $u->email,
                'role' => $u->role,
                'department' => $u->department ? ['id' => $u->department->id, 'name' => $u->department->name] : null,
                'heads_department' => $u->department?->head_user_id === $u->id,
            ])->values(),
            'meta' => ['company_users' => $directory->activeUsersCount()],
        ]);
    }

    /** POST /api/v1/admin/departments/{department}/people { user_ids, head_user_id?, replace_head? } -> the department again */
    public function addPeople(AddDepartmentPeopleRequest $request, int $department, ManageDepartmentPeople $people): JsonResponse
    {
        $directory = $this->directory($request);
        $result = $people->add($directory->find($department), $request->validated('user_ids') ?? [],
            $request->validated('head_user_id'), $request->boolean('replace_head'), $request->user(), $request->ip());

        return DepartmentResource::make($directory->detail($department))
            ->additional(['meta' => ['added' => $result['added'], 'moved' => $result['moved'], 'head' => $result['head']?->full_name]])
            ->response();
    }

    /** POST /api/v1/admin/departments/{department}/head { user_id, replace_head? } */
    public function setHead(SetDepartmentHeadRequest $request, int $department, ManageDepartmentPeople $people): DepartmentResource
    {
        $directory = $this->directory($request);
        $people->setHead($directory->find($department), (int) $request->validated('user_id'), $request->boolean('replace_head'), $request->user(), $request->ip());

        return DepartmentResource::make($directory->detail($department));
    }

    /** DELETE /api/v1/admin/departments/{department}/head  (no head; they stay a member) */
    public function clearHead(Request $request, int $department, ManageDepartmentPeople $people): DepartmentResource
    {
        $directory = $this->directory($request);
        $people->clearHead($directory->find($department), $request->user(), $request->ip());

        return DepartmentResource::make($directory->detail($department));
    }

    /** DELETE /api/v1/admin/departments/{department}/people/{user}  (they have no department now) */
    public function removePerson(Request $request, int $department, int $user, ManageDepartmentPeople $people): DepartmentResource
    {
        $directory = $this->directory($request);
        $people->remove($directory->find($department), $user, $request->user(), $request->ip());

        return DepartmentResource::make($directory->detail($department));
    }

    /** POST /api/v1/admin/departments -> 201 with the new department */
    public function store(StoreDepartmentRequest $request, CreateDepartment $create): JsonResponse
    {
        $department = $create->handle($request->validated(), $request->user(), $request->ip());

        return DepartmentResource::make($department)->response()->setStatusCode(201);
    }

    /** PATCH /api/v1/admin/departments/{department} -> the department + meta.changed (the fields that changed) */
    public function update(UpdateDepartmentRequest $request, int $department, UpdateDepartment $update): DepartmentResource
    {
        $directory = $this->directory($request);
        $result = $update->handle(
            $directory->find($department),
            $request->safe()->only(['name', 'code', 'description', 'head_user_id']),
            $request->validated('updated_at'),
            $request->user(),
            $request->ip(),
        );

        return $this->row($directory, $result['department']->id)->additional(['meta' => ['changed' => $result['changed']]]);
    }

    /** POST /api/v1/admin/departments/{department}/deactivate  { reason? } */
    public function deactivate(DepartmentStatusRequest $request, int $department, SetDepartmentStatus $status): DepartmentResource
    {
        return $this->setStatus($request, $department, $status, false);
    }

    /** POST /api/v1/admin/departments/{department}/reactivate */
    public function reactivate(DepartmentStatusRequest $request, int $department, SetDepartmentStatus $status): DepartmentResource
    {
        return $this->setStatus($request, $department, $status, true);
    }

    private function setStatus(DepartmentStatusRequest $request, int $id, SetDepartmentStatus $status, bool $active): DepartmentResource
    {
        $directory = $this->directory($request);
        $result = $status->handle($directory->find($id), $active, $request->validated('reason'), $request->user(), $request->ip());

        return $this->row($directory, $result['department']->id);
    }

    private function directory(Request $request): DepartmentDirectory
    {
        return new DepartmentDirectory((int) ($request->user()->company_id ?? 0));
    }

    /** The same row the list shows, with fresh counts. */
    private function row(DepartmentDirectory $directory, int $id): DepartmentResource
    {
        return DepartmentResource::make($directory->withRowData($directory->base()->whereKey($id))->firstOrFail());
    }
}
