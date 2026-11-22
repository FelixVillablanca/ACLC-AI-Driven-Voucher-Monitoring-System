<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Domain\Tenancy\Actions\GrantCompanyAccess;
use App\Domain\Tenancy\Queries\AccessCandidates;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\GrantCompanyAccessRequest;
use App\Http\Requests\Admin\ListAccessCandidatesRequest;
use App\Http\Resources\Admin\AccessCandidateResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/** Quick actions → "Grant company access": only ever the Admin's own company. */
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
}
