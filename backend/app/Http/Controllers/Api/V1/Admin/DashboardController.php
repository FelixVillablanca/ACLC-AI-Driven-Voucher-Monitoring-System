<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Domain\Reporting\Queries\AdminDashboardSummary;
use App\Http\Controllers\Controller;
use App\Http\Resources\AdminDashboardResource;
use Illuminate\Http\Request;

/**
 * GET /api/v1/admin/dashboard: the numbers for the admin landing page.
 * Admin only (the `role:admin` middleware on the route checks that first).
 */
class DashboardController extends Controller
{
    public function __invoke(Request $request, AdminDashboardSummary $summary): AdminDashboardResource
    {
        return AdminDashboardResource::make($summary->get($request->user()));
    }
}
