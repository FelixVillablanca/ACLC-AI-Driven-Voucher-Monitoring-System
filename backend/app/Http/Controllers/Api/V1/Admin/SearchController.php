<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Domain\Identity\Queries\AdminSearch;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\AdminSearchRequest;
use App\Http\Resources\Admin\AdminSearchDepartmentResource;
use App\Http\Resources\Admin\AdminSearchUserResource;
use Illuminate\Http\JsonResponse;

/**
 * GET /api/v1/admin/search?q=liza
 * 200 { data: { users: [...], departments: [...] }, meta: { query, company, limit } }
 * Only the Admin's own company is searched (see AdminSearch).
 */
class SearchController extends Controller
{
    public function __invoke(AdminSearchRequest $request, AdminSearch $search): JsonResponse
    {
        $admin = $request->user()->loadMissing('company:id,name');
        $results = $search->run($admin, $request->validated('q'));

        return response()->json([
            'data' => [
                'users' => AdminSearchUserResource::collection($results['users']),
                'departments' => AdminSearchDepartmentResource::collection($results['departments']),
            ],
            'meta' => [
                'query' => $request->validated('q'),
                'company' => $admin->company ? ['id' => $admin->company->id, 'name' => $admin->company->name] : null,
                'limit' => AdminSearch::LIMIT,
            ],
        ]);
    }
}
