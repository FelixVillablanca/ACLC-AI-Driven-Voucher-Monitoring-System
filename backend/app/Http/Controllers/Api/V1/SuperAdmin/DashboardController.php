<?php

namespace App\Http\Controllers\Api\V1\SuperAdmin;

use App\Domain\Reporting\Queries\SuperAdminDashboardSummary;
use App\Http\Controllers\Controller;
use App\Http\Resources\SuperAdminDashboardResource;
use Illuminate\Http\Request;

/**
 * GET /api/v1/superadmin/dashboard: the numbers for the Super Admin landing page (Framer uH0wO9f5O).
 * Super Admin only (the `role:super_admin` middleware on the route checks that first).
 */
class DashboardController extends Controller
{
    public function __invoke(Request $request, SuperAdminDashboardSummary $summary): SuperAdminDashboardResource
    {
        return SuperAdminDashboardResource::make($summary->get($request->user()));
    }
}
