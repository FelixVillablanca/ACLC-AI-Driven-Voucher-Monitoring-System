<?php

namespace App\Http\Controllers\Api\V1\Reports;

use App\Domain\AI\OpenAi\OpenAiClient;
use App\Domain\AI\OpenAi\OpenAiSpend;
use App\Domain\Audit\AuditTrail;
use App\Domain\Reporting\Actions\GenerateReport;
use App\Domain\Reporting\Queries\ReportDirectory;
use App\Domain\Vouchers\VoucherStatus as S;
use App\Http\Controllers\Controller;
use App\Http\Requests\Reports\GenerateReportRequest;
use App\Models\FinancialReport;
use App\Support\Exports\TabularExport;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;

/**
 * The Accounting Officer's Financial reports (2026-11-27; Framer ARxG8Aa6F list, UmSNc_71u report, ZoAX4DKjk generate).
 * Company = X-Company-ID (role:accounting_officer + company). Another company's report = 404.
 *   GET  /officer/reports?type=&department=&search=&page=   list + stats + AI status
 *   GET  /officer/reports/preview?type=…                    "186 approved vouchers · ₱1,284,560 will be included"
 *   POST /officer/reports                                   generate (201; the AI summary follows in the background)
 *   GET  /officer/reports/{id}                              one report (poll while summary_status is queued / writing)
 *   POST /officer/reports/{id}/summary                      write the AI summary again (Regenerate / Retry)
 *   GET  /officer/reports/{id}/pdf | /xlsx                  downloads
 */
class ReportController extends Controller
{
    public function __construct(private GenerateReport $generate) {}

    public function index(Request $request, OpenAiClient $openai, OpenAiSpend $spend): JsonResponse
    {
        $request->validate([
            'type' => ['nullable', 'in:monthly,quarterly,custom'],
            'department' => ['nullable', 'string', 'max:20'],
            'search' => ['nullable', 'string', 'max:100'],
        ]);
        $directory = new ReportDirectory($request->attributes->get('company'));
        $page = $directory->list($request->query('type'), $request->query('department'), $request->query('search'));

        return response()->json([
            'data' => collect($page->items())->map(fn ($r) => ReportDirectory::present($r))->all(),
            'meta' => [
                'current_page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'total' => $page->total(), 'per_page' => $page->perPage(),
                'company' => $request->attributes->get('company')->name,
                'stats' => $directory->stats(),
                'ai' => ['configured' => $openai->configured(), 'model' => $openai->model(), 'paused' => $openai->configured() && $spend->paused()],
                'departments' => DB::table('departments')->where('company_id', $request->attributes->get('company')->id)->orderBy('name')->get(['id', 'name']),
            ],
        ]);
    }

    public function preview(GenerateReportRequest $request): JsonResponse
    {
        $period = $request->period();
        $company = $request->attributes->get('company');
        $row = DB::table('vouchers')->where('company_id', $company->id)->where('status', S::Approved->value)
            ->when($request->input('department_id'), fn ($q, $id) => $q->where('department_id', $id))
            ->whereBetween('approved_at', [$period->start, $period->end])
            ->selectRaw('COUNT(*) as n, COALESCE(SUM(amount), 0) as t')->first();

        return response()->json(['data' => [
            'title' => $period->title(null), 'range' => $period->rangeText(),
            'vouchers' => (int) $row->n, 'total' => (string) $row->t,
        ]]);
    }

    public function store(GenerateReportRequest $request): JsonResponse
    {
        $report = $this->generate->generate($request->attributes->get('company'), $request->user(), $request->period(),
            $request->input('department_id') ? (int) $request->input('department_id') : null, $request->includes(), ip: $request->ip());

        return response()->json(['data' => ReportDirectory::present($report->fresh(['department', 'generator']), full: true)], 201);
    }

    public function show(Request $request, int $report, OpenAiClient $openai, OpenAiSpend $spend): JsonResponse
    {
        return response()->json(['data' => ReportDirectory::present($this->find($request, $report), full: true)
            + ['ai' => ['configured' => $openai->configured(), 'model' => $openai->model(), 'paused' => $openai->configured() && $spend->paused()]]]);
    }

    public function summary(Request $request, int $report): JsonResponse
    {
        $this->find($request, $report);
        $fresh = $this->generate->rewriteSummary($report, $request->attributes->get('company'), $request->user(), $request->ip());

        return response()->json(['data' => ReportDirectory::present($fresh->fresh(['department', 'generator']), full: true)]);
    }

    public function pdf(Request $request, int $report): Response
    {
        $r = $this->find($request, $report);
        $this->audit($request, $r, 'pdf');

        return Pdf::loadView('pdf.report', ['report' => ReportDirectory::present($r, full: true), 'company' => $request->attributes->get('company')])
            ->setPaper('a4')->download($this->fileName($r, 'pdf'));
    }

    public function xlsx(Request $request, int $report, TabularExport $export): Response
    {
        $r = $this->find($request, $report);
        $f = $r->figures ?? [];
        $rows = [
            ['Period', $r->period_start?->format('Y-m-d').' to '.$r->period_end?->format('Y-m-d'), '', ''],
            ['Total spend (PHP)', (float) ($f['total_spend'] ?? 0), '', ''],
            ['Vouchers approved', $f['approved'] ?? 0, '', ''],
            ['Rejected / returned', ($f['rejected'] ?? 0).' / '.($f['returned'] ?? 0), '', ''],
            ['Flagged (still open)', ($f['flagged'] ?? 0).' ('.($f['flagged_open'] ?? 0).')', '', ''],
            ['', '', '', ''],
            ['Department', 'Vouchers', 'Amount (PHP)', 'Change vs previous (%)'],
            ...array_map(fn ($d) => [$d['name'], $d['vouchers'], (float) $d['amount'], $d['change_pct'] ?? ''], $f['departments'] ?? []),
            ['', '', '', ''],
            ['Category', 'Vouchers', 'Amount (PHP)', 'Change vs previous (%)'],
            ...array_map(fn ($c) => [$c['name'], $c['vouchers'], (float) $c['amount'], $c['change_pct'] ?? ''], $f['categories'] ?? []),
        ];
        $this->audit($request, $r, 'xlsx');

        return response($export->xlsx('Report', ['Report', (string) $r->title, '', ''], $rows), 200, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition' => 'attachment; filename="'.$this->fileName($r, 'xlsx').'"',
        ]);
    }

    private function find(Request $request, int $id): FinancialReport
    {
        return FinancialReport::query()->where('company_id', $request->attributes->get('company')->id)
            ->with(['department:id,name', 'generator:id,first_name,last_name'])->findOrFail($id);
    }

    private function fileName(FinancialReport $r, string $ext): string
    {
        return str($r->title)->slug().'.'.$ext;
    }

    private function audit(Request $request, FinancialReport $r, string $format): void
    {
        AuditTrail::record([
            'user_id' => $request->user()->id, 'company_id' => $r->company_id, 'action' => 'report_downloaded',
            'table_name' => 'financial_reports', 'record_id' => $r->id, 'new_values' => ['format' => $format, 'title' => $r->title],
            'ip_address' => $request->ip(),
        ]);
    }
}
