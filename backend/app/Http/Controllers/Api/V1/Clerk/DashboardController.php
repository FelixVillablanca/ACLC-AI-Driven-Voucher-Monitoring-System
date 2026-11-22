<?php

namespace App\Http\Controllers\Api\V1\Clerk;

use App\Domain\Vouchers\Queries\ClerkDashboardSummary;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * GET /api/v1/clerk/dashboard (Framer LolF6YFo5, the Accounting Clerk's landing page).
 * role:accounting_clerk + company (ResolveCompany) run first, so the company here is one the
 * clerk really has access to. Only the clerk's own vouchers are counted.
 */
class DashboardController extends Controller
{
    public function __invoke(Request $request, ClerkDashboardSummary $summary): JsonResponse
    {
        $clerk = $request->user()->loadMissing('department:id,name');

        return response()->json(['data' => $summary->get($clerk, $request->attributes->get('company'))]);
    }
}
