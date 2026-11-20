<?php

namespace App\Http\Controllers\Api\V1\SuperAdmin;

use App\Domain\Security\Support\OwnerActivity;
use App\Http\Controllers\Controller;
use App\Http\Requests\SuperAdmin\ListSecurityAlertsRequest;
use App\Http\Resources\SecurityAlertDetailResource;
use App\Http\Resources\SecurityAlertResource;
use App\Models\SecurityAlert;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;

/**
 * Security alerts panel (Framer mQcXDCyDZ) and Alert detail panel (SCoT_cu7B).
 * Alerts are shared: all Super Admins see the same list and the same review status.
 */
class SecurityAlertController extends Controller
{
    /**
     * GET /api/v1/superadmin/security-alerts  -> newest first, CURSOR pagination
     * ("Load more" keeps working even while new alerts arrive at the top).
     * meta.counts feeds the header and the tab numbers.
     */
    public function index(ListSecurityAlertsRequest $request): AnonymousResourceCollection
    {
        $status = $request->validated('filter.status');

        $alerts = SecurityAlert::query()
            ->with(['user:id,first_name,last_name,role', 'reviewer:id,first_name,last_name'])
            ->when($status === 'open', fn ($q) => $q->open())
            ->when($status === 'closed', fn ($q) => $q->closed())
            ->orderByDesc('id')
            ->cursorPaginate((int) $request->validated('per_page', 20))
            ->withQueryString();

        return SecurityAlertResource::collection($alerts)->additional(['meta' => ['counts' => $this->counts()]]);
    }

    /** GET /api/v1/superadmin/security-alerts/{alert} */
    public function show(SecurityAlert $alert): SecurityAlertDetailResource
    {
        return SecurityAlertDetailResource::make($alert->load(['user.company:id,name', 'reviewer:id,first_name,last_name']));
    }

    /** POST /api/v1/superadmin/security-alerts/{alert}/review  (409 if someone already closed it) */
    public function review(Request $request, SecurityAlert $alert): SecurityAlertResource
    {
        return $this->close($request, $alert, 'reviewed');
    }

    /** POST /api/v1/superadmin/security-alerts/{alert}/dismiss  ("not a real problem") */
    public function dismiss(Request $request, SecurityAlert $alert): SecurityAlertResource
    {
        return $this->close($request, $alert, 'dismissed');
    }

    /** POST /api/v1/superadmin/security-alerts/review-all  -> { reviewed: 3 } */
    public function reviewAll(Request $request): JsonResponse
    {
        $by = $request->user();

        $count = DB::transaction(function () use ($by, $request) {
            $ids = SecurityAlert::open()->lockForUpdate()->pluck('id');
            if ($ids->isEmpty()) {
                return 0;
            }

            SecurityAlert::whereKey($ids)->update(['status' => 'reviewed', 'reviewed_by' => $by->id, 'reviewed_at' => now()]);
            OwnerActivity::audit($by, 'security_alerts_reviewed_all', 'security_alerts', null,
                null, ['ids' => $ids->all(), 'count' => $ids->count()], $request->ip());

            return $ids->count();
        });

        return response()->json(['data' => ['reviewed' => $count], 'meta' => ['counts' => $this->counts()]]);
    }

    private function close(Request $request, SecurityAlert $alert, string $status): SecurityAlertResource
    {
        $closed = DB::transaction(fn () => OwnerActivity::closeAlert($alert->id, $request->user(), $status, $request->ip()));

        return SecurityAlertResource::make($closed->load(['user:id,first_name,last_name,role', 'reviewer:id,first_name,last_name']));
    }

    /** { all, open, closed, last_24h } */
    private function counts(): array
    {
        $row = SecurityAlert::query()->selectRaw(
            "COUNT(*) AS all_count, SUM(status = 'open') AS open_count, SUM(created_at >= ?) AS recent_count",
            [now()->subDay()],
        )->first();

        $all = (int) $row->all_count;
        $open = (int) $row->open_count;

        return ['all' => $all, 'open' => $open, 'closed' => $all - $open, 'last_24h' => (int) $row->recent_count];
    }
}
