<?php

namespace App\Http\Controllers\Api\V1\Approvals;

use App\Domain\Approvals\Queries\OfficerDashboardSummary;
use App\Domain\Approvals\Support\ApprovalRoute;
use App\Http\Controllers\Controller;
use App\Http\Resources\Approvals\QueueVoucherResource;
use App\Support\LiveCounts;
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
        $company = $request->attributes->get('company');

        // Asked again every minute while open: cached 30 s, cleared on any change in the company (LiveCounts)
        return response()->json(['data' => LiveCounts::forCompany('officer-dashboard', $company->id, $request->user()->id, function () use ($request, $company, $route) {
            $summary = new OfficerDashboardSummary($request->user(), $company, $route);

            return [
                'company' => $company->name,
                'queue' => $summary->queue(),
                'mine' => $summary->mine(),
                'review_time' => $summary->reviewTime(),
                'top' => QueueVoucherResource::collection($summary->top())->resolve($request),
                'budgets' => $summary->budgets(),
                'spend' => $summary->spend(),
            ];
        })]);
    }
}
