<?php

namespace App\Http\Controllers\Api\V1\Approvals;

use App\Domain\Approvals\Queries\OfficerDashboardSummary;
use App\Domain\Approvals\Support\ApprovalRoute;
use App\Http\Controllers\Controller;
use App\Http\Resources\Approvals\QueueVoucherResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * GET /api/v1/officer/dashboard: the Accounting Officer's landing page (Framer tfDekIe0N), 2026-11-27.
 * One request for the whole page; the company in X-Company-ID. See OfficerDashboardSummary.
 */
class OfficerDashboardController extends Controller
{
    public function __invoke(Request $request, ApprovalRoute $route): JsonResponse
    {
        $summary = new OfficerDashboardSummary($request->user(), $request->attributes->get('company'), $route);

        return response()->json(['data' => [
            'company' => $request->attributes->get('company')->name,
            'queue' => $summary->queue(),
            'mine' => $summary->mine(),
            'review_time' => $summary->reviewTime(),
            'top' => QueueVoucherResource::collection($summary->top())->resolve($request),
            'budgets' => $summary->budgets(),
            'spend' => $summary->spend(),
        ]]);
    }
}
