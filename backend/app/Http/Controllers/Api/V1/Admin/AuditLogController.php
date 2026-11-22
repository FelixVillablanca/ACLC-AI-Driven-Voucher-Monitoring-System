<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Domain\Audit\AuditCatalog;
use App\Domain\Audit\AuditEntryPresenter;
use App\Domain\Audit\AuditTrail;
use App\Domain\Audit\Queries\AuditLogSearch;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\ListCompanyAuditLogsRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

/**
 * System → Audit logs for an Admin (code-first 2026-11-22). Read-only.
 * Only the Admin's own company, and never voucher activity (Admins have no voucher access).
 * Uses the same search, catalog and presenter as the Super Admin's Audit logs tab.
 *   GET /api/v1/admin/audit-logs        one page (25), newest first + meta.groups (counts) + meta.summary
 *   GET /api/v1/admin/audit-logs/{id}   one entry + its tamper check; any other entry = 404
 */
class AuditLogController extends Controller
{
    public function __construct(private AuditLogSearch $search) {}

    public function index(ListCompanyAuditLogsRequest $request): JsonResponse
    {
        $filters = $request->filters();
        $page = $this->search->page($filters, 25, (int) $request->validated('page', 1));
        $presenter = (new AuditEntryPresenter($request->user()->id))->prime(collect($page->items()));
        $scope = ['company_only' => $filters['company_only'], 'hide_groups' => $filters['hide_groups']];

        return response()->json([
            'data' => collect($page->items())->map(fn ($r) => $presenter->row($r))->values(),
            'meta' => [
                'current_page' => $page->currentPage(),
                'last_page' => $page->lastPage(),
                'from' => $page->firstItem(),
                'to' => $page->lastItem(),
                'total' => $page->total(),
                'range' => ['from' => $filters['from'], 'to' => $filters['to']],
                'groups' => $this->search->facets($filters)['groups'],
                'group_options' => collect(AuditCatalog::groups())->whereIn('key', ListCompanyAuditLogsRequest::GROUPS)->map(fn ($g) => ['key' => $g['key'], 'label' => $g['label']])->values(),
                'summary' => $this->summary($scope),
            ],
        ]);
    }

    public function show(Request $request, int $id): JsonResponse
    {
        $scope = ['company_only' => (int) ($request->user()->company_id ?? 0) ?: -1, 'hide_groups' => ['vouchers']];

        $row = $this->search->filtered($scope)
            ->leftJoin('users', 'users.id', '=', 'audit_logs.user_id')
            ->leftJoin('companies', 'companies.id', '=', 'audit_logs.company_id')
            ->where('audit_logs.id', $id)
            ->first(['audit_logs.*', 'users.first_name as user_first_name', 'users.last_name as user_last_name',
                'users.email as user_email', 'users.role as user_role', 'companies.name as company_name']);

        if (! $row) {
            abort(404);
        }

        $presenter = (new AuditEntryPresenter($request->user()->id))->prime(collect([$row]));

        return response()->json(['data' => [
            ...$presenter->row($row),
            'integrity' => match (AuditTrail::verify($row)) {
                true => 'intact',
                false => 'changed',
                null => 'not_sealed',
            },
        ]]);
    }

    /** The 4 cards: always this company, never filtered. */
    private function summary(array $scope): array
    {
        $logs = fn () => $this->search->filtered($scope);
        $today = Carbon::today();

        return [
            'events_today' => $logs()->where('audit_logs.created_at', '>=', $today)->count(),
            'people_today' => $logs()->where('audit_logs.created_at', '>=', $today)->whereNotNull('audit_logs.user_id')->distinct()->count('audit_logs.user_id'),
            'sensitive_7d' => $logs()->where('audit_logs.created_at', '>=', now()->subDays(7))->whereIn('audit_logs.action', AuditCatalog::sensitiveActions())->count(),
            'failed_sign_ins_7d' => $logs()->where('audit_logs.created_at', '>=', now()->subDays(7))->where('audit_logs.action', 'login_failed')->count(),
        ];
    }
}
