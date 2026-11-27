<?php

namespace App\Http\Controllers\Api\V1\Approvals;

use App\Domain\Audit\AuditCatalog;
use App\Domain\Audit\AuditEntryPresenter;
use App\Domain\Audit\AuditTrail;
use App\Domain\Audit\Queries\AuditLogSearch;
use App\Http\Controllers\Controller;
use App\Http\Requests\Approvals\ListSupervisorAuditRequest;
use App\Support\Exports\TabularExport;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;
use Illuminate\Support\Carbon;

/**
 * The Supervisor / Manager's Audit trail (2026-11-27; Framer xqItzoFYK list, cm5eFM0vJ entry drawer). Read-only.
 * Company = X-Company-ID (role:supervisor_manager + company). Only voucher, approval, budget, report and forecast activity
 * of that company (sign-ins, users and settings stay with the Admin / Super Admin). Money is shown (a finance role);
 * secrets never are. Uses the same search, catalog and presenter as the other audit pages.
 *   GET /supervisor/audit          one page (25), newest first + cards + filter options
 *   GET /supervisor/audit/{id}     one entry + its tamper check (outside the scope = 404)
 *   GET /supervisor/audit/export   CSV of the filtered entries (max 5,000; audit `audit_exported`)
 */
class SupervisorAuditController extends Controller
{
    public function __construct(private AuditLogSearch $search) {}

    public function index(ListSupervisorAuditRequest $request): JsonResponse
    {
        $filters = $request->filters();
        $page = $this->search->page($filters, 25, (int) $request->validated('page', 1));
        $presenter = (new AuditEntryPresenter($request->user()->id, finance: true))->prime(collect($page->items()));
        $inRange = $request->scope() + ['from' => $filters['from'], 'to' => $filters['to']];
        $logs = fn () => $this->search->filtered($inRange);

        return response()->json([
            'data' => collect($page->items())->map(fn ($r) => $presenter->row($r))->values(),
            'meta' => [
                'current_page' => $page->currentPage(), 'last_page' => $page->lastPage(),
                'from' => $page->firstItem(), 'to' => $page->lastItem(), 'total' => $page->total(),
                'range' => ['from' => $filters['from'], 'to' => $filters['to'] ?? now()->toDateString()],
                // the 3 cards: the chosen dates, but not the other filters
                'summary' => [
                    'events' => $logs()->count(),
                    'people' => $logs()->whereNotNull('audit_logs.user_id')->distinct()->count('audit_logs.user_id'),
                    'decisions' => $logs()->whereIn('audit_logs.action', ['voucher_approved', 'voucher_rejected', 'voucher_returned'])->count(),
                    'sensitive' => $logs()->whereIn('audit_logs.action', AuditCatalog::sensitiveActions())->count(),
                ],
                'options' => $this->options($request),
            ],
        ]);
    }

    public function show(ListSupervisorAuditRequest $request, int $id): JsonResponse
    {
        $row = $this->search->filtered($request->scope())
            ->leftJoin('users', 'users.id', '=', 'audit_logs.user_id')
            ->leftJoin('companies', 'companies.id', '=', 'audit_logs.company_id')
            ->where('audit_logs.id', $id)
            ->first(['audit_logs.*', 'users.first_name as user_first_name', 'users.last_name as user_last_name',
                'users.email as user_email', 'users.role as user_role', 'companies.name as company_name']);
        abort_if(! $row, 404);

        $presenter = (new AuditEntryPresenter($request->user()->id, finance: true))->prime(collect([$row]));

        return response()->json(['data' => [
            ...$presenter->row($row),
            'table' => $row->table_name,
            'record_id' => $row->record_id ? (int) $row->record_id : null,
            'link' => $this->link($row),
            'integrity' => match (AuditTrail::verify($row)) {
                true => 'intact',
                false => 'changed',
                null => 'not_sealed',
            },
        ]]);
    }

    public function export(ListSupervisorAuditRequest $request, TabularExport $export): Response
    {
        $filters = $request->filters();
        $rows = $this->search->filtered($filters)
            ->leftJoin('users', 'users.id', '=', 'audit_logs.user_id')
            ->leftJoin('companies', 'companies.id', '=', 'audit_logs.company_id')
            ->orderByDesc('audit_logs.created_at')->orderByDesc('audit_logs.id')->limit(5000)
            ->get(['audit_logs.*', 'users.first_name as user_first_name', 'users.last_name as user_last_name',
                'users.email as user_email', 'users.role as user_role', 'companies.name as company_name']);
        $presenter = (new AuditEntryPresenter($request->user()->id, finance: true))->prime($rows);
        $lines = $rows->map(function ($r) use ($presenter) {
            $e = $presenter->row($r);

            return [
                Carbon::parse($e['at'])->format('Y-m-d H:i:s'), '#'.$e['id'], $e['who']['name'], $e['who']['role'] ?? '',
                $e['action']['label'], $e['record']['title'], $e['record']['subtitle'] ?? '', $e['ip'] ?? '',
                collect($e['changes'])->map(fn ($c) => "{$c['field']}: ".($c['old'] ?? '—').' → '.($c['new'] ?? '—'))->implode('; '),
            ];
        })->all();
        $company = $request->attributes->get('company');

        AuditTrail::record([
            'user_id' => $request->user()->id, 'company_id' => $company->id, 'action' => 'audit_exported',
            'table_name' => 'audit_logs',
            'new_values' => ['scope' => 'supervisor', 'from' => $filters['from'], 'to' => $filters['to'], 'count' => count($lines)],
            'ip_address' => $request->ip(),
        ]);

        return response($export->csv(['When', 'Entry', 'User', 'Role', 'Action', 'Record', 'Detail', 'IP address', 'Changes'], $lines), 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="audit-trail-'.str($company->name)->slug().'-'.now()->format('Y-m-d').'.csv"',
            'Cache-Control' => 'no-store',
        ]);
    }

    /** The User / Action / Table dropdowns: only what appears in this company's trail. */
    private function options(ListSupervisorAuditRequest $request): array
    {
        $scope = $request->scope();
        $users = $this->search->filtered($scope)->join('users', 'users.id', '=', 'audit_logs.user_id')
            ->select(['users.id', 'users.first_name', 'users.last_name'])->distinct()->orderBy('users.first_name')->get()
            ->map(fn ($u) => ['id' => (int) $u->id, 'name' => trim("{$u->first_name} {$u->last_name}")]);
        $used = $this->search->filtered($scope)->distinct()->pluck('audit_logs.action')->all();
        $tables = $this->search->filtered($scope)->distinct()->pluck('audit_logs.table_name')->all();

        return [
            'users' => $users->values()->all(),
            'actions' => collect(ListSupervisorAuditRequest::actions())->filter(fn ($a) => in_array($a, $used, true))
                ->map(fn ($a) => ['key' => $a, 'label' => AuditCatalog::describe($a)['label']])->values()->all(),
            'tables' => collect(AuditLogSearch::VOUCHER_TABLES)->filter(fn ($t) => in_array($t, $tables, true))->values()->all(),
        ];
    }

    /** Where "Open …" goes: the voucher's final review, the budgets page, a report. */
    private function link(object $row): ?array
    {
        if (! $row->record_id) {
            return null;
        }

        return match ($row->table_name) {
            'vouchers' => ['kind' => 'voucher', 'id' => (int) $row->record_id],
            'budget_allocations' => ['kind' => 'budget', 'id' => (int) $row->record_id],
            default => null,
        };
    }
}
