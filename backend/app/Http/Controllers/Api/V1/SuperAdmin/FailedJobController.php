<?php

namespace App\Http\Controllers\Api\V1\SuperAdmin;

use App\Domain\Platform\FailedJobs;
use App\Http\Controllers\Controller;
use App\Http\Requests\SuperAdmin\FailedJobIdsRequest;
use Illuminate\Http\JsonResponse;

/**
 * "Retry failed jobs" (Framer fzdOvPqCX), opened from the dashboard's
 * "N background jobs failed" row.
 */
class FailedJobController extends Controller
{
    /** GET /api/v1/superadmin/failed-jobs → { data: [jobs], meta: { total, services: { ml: "ok" } } } */
    public function index(FailedJobs $failed): JsonResponse
    {
        $list = $failed->list();

        return response()->json(['data' => $list['jobs'], 'meta' => ['total' => $list['total'], 'services' => $list['services']]]);
    }

    /** POST /api/v1/superadmin/failed-jobs/retry { ids } → { retried: 2 } */
    public function retry(FailedJobIdsRequest $request, FailedJobs $failed): JsonResponse
    {
        return response()->json(['data' => ['retried' => $failed->retry($request->validated('ids'), $request->user(), $request->ip())]]);
    }

    /** DELETE /api/v1/superadmin/failed-jobs { ids } → { deleted: 2 } */
    public function destroy(FailedJobIdsRequest $request, FailedJobs $failed): JsonResponse
    {
        return response()->json(['data' => ['deleted' => $failed->delete($request->validated('ids'), $request->user(), $request->ip())]]);
    }
}
