<?php

namespace App\Http\Controllers\Api\V1\SuperAdmin;

use App\Domain\Audit\AuditCatalog;
use App\Domain\Audit\AuditEntryPresenter;
use App\Domain\Audit\AuditTrail;
use App\Domain\Audit\Queries\AuditLogSearch;
use App\Domain\Security\Queries\IpActivity;
use App\Exceptions\ApiException;
use App\Http\Controllers\Controller;
use App\Http\Requests\SuperAdmin\ExportAuditLogsRequest;
use App\Http\Requests\SuperAdmin\ListAuditLogsRequest;
use App\Support\Exports\TabularExport;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * The Super Admin's Audit logs tab (Framer EJ0asP2ZH) and AL1–AL9.
 * READ-ONLY: there is no route that edits or deletes an entry. Money is never shown.
 */
class AuditLogController extends Controller
{
    public function __construct(private AuditLogSearch $search) {}

    /**
     * GET /api/v1/superadmin/audit-logs
     *   data         one page of entries, newest first (25 a page)
     *   meta.facets  the numbers in the company (AL3) and action (AL4) filters
     *   meta.summary the 4 cards
     *   meta.ip      what that address did today, when the search is an IP (AL2 banner)
     */
    public function index(ListAuditLogsRequest $request, IpActivity $ip): JsonResponse
    {
        $filters = $request->filters();
        $page = $this->search->page($filters, 25, (int) $request->validated('page', 1));
        $presenter = (new AuditEntryPresenter($request->user()->id))->prime(collect($page->items()));
        $search = trim((string) $filters['search']);

        return response()->json([
            'data' => collect($page->items())->map(fn ($row) => $presenter->row($row))->all(),
            'meta' => [
                'current_page' => $page->currentPage(),
                'last_page' => $page->lastPage(),
                'from' => $page->firstItem(),
                'to' => $page->lastItem(),
                'total' => $page->total(),
                'range' => ['from' => $filters['from'], 'to' => $filters['to']],
                // the AL1 export's "All events" / "Sensitive only" counts: the same dates, no other filters
                'range_counts' => [
                    'all' => $this->search->filtered(['from' => $filters['from'], 'to' => $filters['to']])->count(),
                    'sensitive' => $this->search->filtered(['from' => $filters['from'], 'to' => $filters['to'], 'sensitive' => true])->count(),
                ],
                'facets' => $this->search->facets($filters),
                'summary' => $this->search->summary(),
                'ip' => filter_var($search, FILTER_VALIDATE_IP) ? $ip->summary($search) : null,
            ],
        ]);
    }

    /** GET /api/v1/superadmin/audit-logs/options  (what the filter dropdowns offer) */
    public function options(): JsonResponse
    {
        return response()->json(['data' => [
            'companies' => DB::table('companies')->orderBy('name')
                ->get(['id', 'name', 'is_active', 'suspended_at'])
                ->map(fn ($c) => ['id' => $c->id, 'name' => $c->name, 'suspended' => $c->suspended_at !== null])->all(),
            'groups' => AuditCatalog::groups(),
        ]]);
    }

    /**
     * GET /api/v1/superadmin/audit-logs/{id}  (AL7 Event details)
     * Adds: the tamper check, the other entries of the same request, and how much else that person did today.
     */
    public function show(Request $request, int $id): JsonResponse
    {
        $row = $this->search->filtered([])
            ->leftJoin('users', 'users.id', '=', 'audit_logs.user_id')
            ->leftJoin('companies', 'companies.id', '=', 'audit_logs.company_id')
            ->where('audit_logs.id', $id)
            ->first(['audit_logs.*', 'users.first_name as user_first_name', 'users.last_name as user_last_name',
                'users.email as user_email', 'users.role as user_role', 'companies.name as company_name']);

        if (! $row) {
            throw new ApiException('That audit entry doesn’t exist.', 'AUDIT_ENTRY_NOT_FOUND', 404);
        }

        $presenter = (new AuditEntryPresenter($request->user()->id))->prime(collect([$row]));
        $sameRequest = $row->request_id
            ? DB::table('audit_logs')->where('request_id', $row->request_id)->where('id', '!=', $row->id)
                ->orderBy('id')->limit(10)->get(['id', 'action'])
                ->map(fn ($r) => ['id' => $r->id, 'label' => AuditCatalog::describe($r->action)['label']])->all()
            : [];

        $day = Carbon::parse($row->created_at);
        $moreToday = $row->user_id
            ? DB::table('audit_logs')->where('user_id', $row->user_id)->where('id', '!=', $row->id)
                ->whereBetween('created_at', [$day->copy()->startOfDay(), $day->copy()->endOfDay()])->count()
            : 0;

        $target = match (true) {
            $row->table_name === 'users' && $row->record_id
                && DB::table('users')->where('id', $row->record_id)->whereIn('role', ['admin', 'super_admin'])->exists() => ['type' => 'admin', 'id' => (int) $row->record_id],
            $row->table_name === 'companies' && $row->record_id => ['type' => 'company', 'id' => (int) $row->record_id],
            default => null,
        };

        return response()->json(['data' => [
            ...$presenter->row($row),
            'integrity' => match (AuditTrail::verify($row)) {
                true => 'intact',
                false => 'changed',
                null => 'not_sealed', // written before fingerprints existed
            },
            'same_request' => $sameRequest,
            'more_from_person_that_day' => $moreToday,
            'target' => $target,
        ]]);
    }

    /** GET /api/v1/superadmin/audit-logs/ip/{ip}  (AL8 evidence; also the AL2 banner) */
    public function ip(string $ip, IpActivity $activity): JsonResponse
    {
        if (! filter_var($ip, FILTER_VALIDATE_IP)) {
            throw new ApiException('That isn’t a valid IP address.', 'INVALID_IP', 422);
        }

        return response()->json(['data' => $activity->summary($ip)]);
    }

    /**
     * GET /api/v1/superadmin/audit-logs/export  (AL1) → a CSV file.
     * The file holds names, emails and IP addresses, so the export is itself written to the log.
     */
    public function export(ExportAuditLogsRequest $request, TabularExport $files): Response
    {
        $filters = $request->filters();
        $query = $this->search->filtered($filters);
        $count = (clone $query)->count();

        if ($count > ExportAuditLogsRequest::MAX_ROWS) {
            throw new ApiException('That’s '.number_format($count).' events, more than '.number_format(ExportAuditLogsRequest::MAX_ROWS)
                .' fit in one file. Choose a shorter date range.', 'EXPORT_TOO_LARGE', 422);
        }

        $include = $request->validated('include', []);
        $headers = ['Time', 'Who', 'Role', 'Action', 'Sensitive', 'Record', 'Company', 'IP address'];
        if (in_array('values', $include, true)) {
            $headers[] = 'What changed';
        }
        if (in_array('request', $include, true)) {
            array_push($headers, 'Request ID', 'Browser');
        }

        $rows = [];
        $presenter = new AuditEntryPresenter($request->user()->id);
        $query->leftJoin('users', 'users.id', '=', 'audit_logs.user_id')
            ->leftJoin('companies', 'companies.id', '=', 'audit_logs.company_id')
            ->select(['audit_logs.*', 'users.first_name as user_first_name', 'users.last_name as user_last_name',
                'users.email as user_email', 'users.role as user_role', 'companies.name as company_name'])
            ->orderByDesc('audit_logs.created_at')->orderByDesc('audit_logs.id')
            ->chunk(1000, function ($chunk) use (&$rows, $presenter, $include) {
                $presenter->prime($chunk);
                foreach ($chunk as $r) {
                    $e = $presenter->row($r);
                    $row = [
                        Carbon::parse($e['at'])->format('Y-m-d H:i:s'),
                        $e['who']['name'].($e['who']['kind'] === 'person' && $e['who']['email'] ? " <{$e['who']['email']}>" : ''),
                        $e['who']['role'] ?? '',
                        $e['action']['label'],
                        $e['action']['sensitive'] ? 'yes' : '',
                        trim($e['record']['title'].($e['record']['subtitle'] ? " ({$e['record']['subtitle']})" : '')),
                        $e['company']['name'] ?? 'Platform',
                        (string) $e['ip'],
                    ];
                    if (in_array('values', $include, true)) {
                        $row[] = collect($e['changes'])->map(fn ($c) => "{$c['field']}: ".($c['old'] ?? '—').' → '.($c['new'] ?? '—'))->implode('; ');
                    }
                    if (in_array('request', $include, true)) {
                        array_push($row, (string) $e['request_id'], (string) $e['browser']);
                    }
                    $rows[] = $row;
                }
            });

        AuditTrail::record([
            'user_id' => $request->user()->id,
            'action' => 'audit_exported',
            'table_name' => 'audit_logs',
            'new_values' => ['count' => count($rows), 'events' => $request->validated('events'), 'from' => $filters['from'] ?? null,
                'to' => $filters['to'] ?? null, 'include' => $include],
            'ip_address' => $request->ip(),
        ]);

        return response($files->csv($headers, $rows), 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="audit-log-'.now()->format('Y-m-d').'.csv"',
            'Cache-Control' => 'no-store', // personal data: don't keep copies in browser/proxy caches
        ]);
    }
}
