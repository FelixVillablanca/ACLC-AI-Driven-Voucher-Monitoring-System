<?php

namespace App\Http\Controllers\Api\V1\Clerk;

use App\Domain\Vouchers\Queries\ClerkDashboardSummary;
use App\Http\Controllers\Controller;
use App\Support\LiveCounts;
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
        $clerk = $request->user();
        $company = $request->attributes->get('company');

        // Sidebar + landing page in one: cached 30 s, cleared when a voucher of the company changes (LiveCounts)
        return response()->json(['data' => LiveCounts::forCompany('clerk-dashboard', $company->id, $clerk->id,
            fn () => $summary->get($clerk->loadMissing('department:id,name'), $company))]);
    }
}
