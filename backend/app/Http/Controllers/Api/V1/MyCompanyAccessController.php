<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Tenancy\Actions\CrossCompanyAccess;
use App\Domain\Tenancy\Queries\MyCompanyAccess;
use App\Http\Controllers\Controller;
use App\Http\Requests\Account\JoinCompanyRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

/**
 * "Join another company" for clerks, officers and supervisors (2026-11-22). Always YOUR OWN access,
 * so there's no user id in the address and no X-Company-ID needed.
 *   GET    /me/company-access?search=                  companies, invitations, my requests, companies I can ask
 *   POST   /me/company-access/requests                 ask to join { company_id, message? }
 *   DELETE /me/company-access/requests/{company}       cancel my request
 *   POST   /me/company-access/invitations/{company}/accept|decline
 */
class MyCompanyAccessController extends Controller
{
    public function __construct(private CrossCompanyAccess $access) {}

    public function show(Request $request, MyCompanyAccess $mine): JsonResponse
    {
        $search = is_string($request->query('search')) ? mb_substr(trim($request->query('search')), 0, 100) : null;

        return response()->json(['data' => $mine->overview($request->user(), $search ?: null)]);
    }

    public function request(JoinCompanyRequest $request): JsonResponse
    {
        $company = $this->access->request($request->user(), (int) $request->validated('company_id'), $request->validated('message'), $request->ip());

        return response()->json(['data' => ['company' => ['id' => $company->id, 'name' => $company->name]]], 201);
    }

    public function cancelRequest(Request $request, int $company): Response
    {
        $this->access->cancelRequest($request->user(), $company, $request->ip());

        return response()->noContent();
    }

    public function accept(Request $request, int $company): JsonResponse
    {
        $joined = $this->access->answerInvite($request->user(), $company, true, $request->ip());

        return response()->json(['data' => ['company' => ['id' => $joined->id, 'name' => $joined->name]]]);
    }

    public function decline(Request $request, int $company): Response
    {
        $this->access->answerInvite($request->user(), $company, false, $request->ip());

        return response()->noContent();
    }
}
