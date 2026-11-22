<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Domain\Tenancy\Actions\GrantCompanyAccess;
use App\Domain\Tenancy\Actions\RevokeCompanyAccess;
use App\Domain\Tenancy\Queries\AccessCandidates;
use App\Domain\Tenancy\Queries\CompanyAccessDirectory;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\DepartmentStatusRequest;
use App\Http\Requests\Admin\GrantCompanyAccessRequest;
use App\Http\Requests\Admin\ListAccessCandidatesRequest;
use App\Http\Requests\Admin\ListCompanyAccessRequest;
use App\Http\Resources\Admin\AccessCandidateResource;
use App\Http\Resources\Admin\CompanyAccessRowResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * People & Access → Company access page + Quick actions "Grant company access".
 * Only ever the Admin's own company.
 */
class CompanyAccessController extends Controller
{
    /**
     * GET /api/v1/admin/company-access/candidates?search=
     * 200 { data: [people without access], meta: { total, shown, company } }
     */
    public function candidates(ListAccessCandidatesRequest $request, AccessCandidates $candidates): AnonymousResourceCollection
    {
        $admin = $request->user()->loadMissing('company:id,name');
        $result = $candidates->list((int) $admin->company_id, $request->validated('search'));

        return AccessCandidateResource::collection($result['users'])->additional(['meta' => [
            'total' => $result['total'],
            'shown' => $result['users']->count(),
            'company' => $admin->company ? ['id' => $admin->company->id, 'name' => $admin->company->name] : null,
        ]]);
    }

    /** POST /api/v1/admin/company-access { user_ids } -> 200 { data: [granted people], meta: { granted } } */
    public function store(GrantCompanyAccessRequest $request, GrantCompanyAccess $grant): JsonResponse
    {
        $users = $grant->handle($request->validated('user_ids'), $request->user(), $request->ip());

        return response()->json([
            'data' => collect($users)->map(fn ($u) => ['id' => $u->id, 'full_name' => $u->full_name, 'role' => $u->role])->values(),
            'meta' => ['granted' => count($users)],
        ]);
    }

    /** GET /api/v1/admin/company-access  (the page: everyone + their access to this company) */
    public function index(ListCompanyAccessRequest $request): AnonymousResourceCollection
    {
        $directory = new CompanyAccessDirectory((int) ($request->user()->company_id ?? 0));
        $search = $request->validated('search');

        $page = $directory->sort($directory->view($directory->base($search), $request->validated('filter.view')), $request->validated('sort'))
            ->paginate((int) $request->validated('per_page', 20))->withQueryString();

        return CompanyAccessRowResource::collection($page)->additional(['meta' => [
            'views' => $directory->viewCounts($search),
            'summary' => $directory->summary(),
        ]]);
    }

    /** POST /api/v1/admin/company-access/{user}/revoke  { reason? } -> 200 { data: { id, full_name } } */
    public function revoke(DepartmentStatusRequest $request, int $user, RevokeCompanyAccess $revoke): JsonResponse
    {
        $person = $revoke->handle($user, $request->validated('reason'), $request->user(), $request->ip());

        return response()->json(['data' => ['id' => $person->id, 'full_name' => $person->full_name]]);
    }
}
