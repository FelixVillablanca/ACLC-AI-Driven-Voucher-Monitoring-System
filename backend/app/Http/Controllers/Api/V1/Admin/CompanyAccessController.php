<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Domain\Tenancy\Actions\CrossCompanyAccess;
use App\Domain\Tenancy\Actions\GrantCompanyAccess;
use App\Domain\Tenancy\Actions\RevokeCompanyAccess;
use App\Domain\Tenancy\Queries\AccessCandidates;
use App\Domain\Tenancy\Queries\CompanyAccessDirectory;
use App\Domain\Tenancy\Queries\CrossCompanyDirectory;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\DepartmentStatusRequest;
use App\Http\Requests\Admin\GrantCompanyAccessRequest;
use App\Http\Requests\Admin\InviteToCompanyRequest;
use App\Http\Requests\Admin\ListAccessCandidatesRequest;
use App\Http\Requests\Admin\ListCompanyAccessRequest;
use App\Http\Resources\Admin\AccessCandidateResource;
use App\Http\Resources\Admin\CompanyAccessRowResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

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
        $view = $request->validated('filter.view', 'in_company');

        $query = $directory->base($view, $search);
        if ($view === 'in_company') {
            $directory->access($query, $request->validated('filter.access'));
        }
        $page = $directory->sort($query, $request->validated('sort'))
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

    // ---------- Between companies (2026-11-22) ----------

    /** GET /admin/company-access/directory?search=  people of OTHER companies you could invite (name, role, home company only) */
    public function directory(Request $request): JsonResponse
    {
        $search = is_string($request->query('search')) ? mb_substr(trim($request->query('search')), 0, 100) : null;
        $page = (new CrossCompanyDirectory((int) ($request->user()->company_id ?? 0)))->invitable($search ?: null);

        return response()->json([
            'data' => $page->items(),
            'meta' => ['current_page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'total' => $page->total()],
        ]);
    }

    /** GET /admin/company-access/pending  { requests: [people asking to join], invites: [your open invitations] } */
    public function pending(Request $request): JsonResponse
    {
        return response()->json(['data' => (new CrossCompanyDirectory((int) ($request->user()->company_id ?? 0)))->pending()]);
    }

    /** POST /admin/company-access/invitations { user_id, message? } -> 201 */
    public function invite(InviteToCompanyRequest $request, CrossCompanyAccess $access): JsonResponse
    {
        $person = $access->invite($request->user(), (int) $request->validated('user_id'), $request->validated('message'), $request->ip());

        return response()->json(['data' => CrossCompanyDirectory::card($person->loadMissing('company:id,name'))], 201);
    }

    /** DELETE /admin/company-access/invitations/{user} -> 204 */
    public function cancelInvite(Request $request, int $user, CrossCompanyAccess $access): Response
    {
        $access->cancelInvite($request->user(), $user, $request->ip());

        return response()->noContent();
    }

    /** POST /admin/company-access/requests/{user}/approve -> 200 */
    public function approve(Request $request, int $user, CrossCompanyAccess $access): JsonResponse
    {
        $person = $access->answerRequest($request->user(), $user, true, null, $request->ip());

        return response()->json(['data' => ['id' => $person->id, 'full_name' => $person->full_name]]);
    }

    /** POST /admin/company-access/requests/{user}/decline { reason? } -> 200 */
    public function decline(DepartmentStatusRequest $request, int $user, CrossCompanyAccess $access): JsonResponse
    {
        $person = $access->answerRequest($request->user(), $user, false, $request->validated('reason'), $request->ip());

        return response()->json(['data' => ['id' => $person->id, 'full_name' => $person->full_name]]);
    }
}
