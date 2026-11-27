<?php

namespace App\Http\Controllers\Api\V1\Reports;

use App\Domain\AI\OpenAi\OpenAiClient;
use App\Domain\AI\OpenAi\OpenAiSpend;
use App\Domain\Audit\AuditTrail;
use App\Domain\Reporting\Actions\SignOffReport;
use App\Domain\Reporting\Queries\ReportDirectory;
use App\Http\Controllers\Controller;
use App\Models\FinancialReport;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

/**
 * The Supervisor / Manager's Financial reports (2026-11-27; Framer AaD8UZ08p list, dcfDyyuKE sign-off). Reports are made
 * by Accounting; the Supervisor reads them, downloads the PDF and signs off company-wide monthly / quarterly ones (or
 * sends them back). Company = X-Company-ID (role:supervisor_manager + company); another company's report = 404.
 *   GET  /supervisor/reports?type=&signoff=&page=     list + cards
 *   GET  /supervisor/reports/{id}                     one report + the sign-off checklist
 *   POST /supervisor/reports/{id}/signoff             checks.summary_reviewed?, checks.flags_noted?, comment?
 *   POST /supervisor/reports/{id}/return              note
 *   GET  /supervisor/reports/{id}/pdf
 */
class SupervisorReportController extends Controller
{
    public function __construct(private SignOffReport $signoff) {}

    public function index(Request $request, OpenAiClient $openai, OpenAiSpend $spend): JsonResponse
    {
        $request->validate([
            'type' => ['nullable', 'in:monthly,quarterly,custom'],
            'signoff' => ['nullable', 'in:pending,signed,returned,not_needed'],
            'page' => ['sometimes', 'integer', 'min:1'],
        ]);
        $company = $request->attributes->get('company');
        $directory = new ReportDirectory($company);
        $page = $directory->list($request->input('type'), null, null, $request->input('signoff'));
        $waiting = FinancialReport::query()->where('company_id', $company->id)->where('signoff_status', 'pending')
            ->orderByDesc('generated_at')->limit(3)->pluck('title');

        return response()->json([
            'data' => collect($page->items())->map(fn ($r) => ReportDirectory::present($r))->all(),
            'meta' => [
                'current_page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'total' => $page->total(), 'per_page' => $page->perPage(),
                'from' => $page->firstItem(), 'to' => $page->lastItem(),
                'company' => $company->name,
                'stats' => $directory->stats() + ['to_sign' => [
                    'count' => FinancialReport::query()->where('company_id', $company->id)->where('signoff_status', 'pending')->count(),
                    'titles' => $waiting->all(),
                ]],
                'ai' => ['configured' => $openai->configured(), 'model' => $openai->model(), 'paused' => $openai->configured() && $spend->paused()],
            ],
        ]);
    }

    public function show(Request $request, int $report, OpenAiClient $openai, OpenAiSpend $spend): JsonResponse
    {
        $r = $this->find($request, $report);

        return response()->json(['data' => ReportDirectory::present($r, full: true) + [
            'checks' => $r->signoff_status === 'pending' ? $this->signoff->checks($r) : null,
            'ai' => ['configured' => $openai->configured(), 'model' => $openai->model(), 'paused' => $openai->configured() && $spend->paused()],
        ]]);
    }

    public function signOff(Request $request, int $report): JsonResponse
    {
        $data = $request->validate([
            'checks' => ['sometimes', 'array'],
            'checks.summary_reviewed' => ['sometimes', 'boolean'],
            'checks.flags_noted' => ['sometimes', 'boolean'],
            'comment' => ['sometimes', 'nullable', 'string', 'max:1000'],
        ]);
        $r = $this->signoff->signOff($report, $data['checks'] ?? [], isset($data['comment']) ? trim($data['comment']) : null,
            $request->user(), $request->attributes->get('company'), $request->ip());

        return response()->json(['data' => ['id' => $r->id, 'signoff_status' => $r->signoff_status]]);
    }

    public function sendBack(Request $request, int $report): JsonResponse
    {
        $data = $request->validate(['note' => ['required', 'string', 'min:3', 'max:1000']],
            ['note.required' => 'Tell Accounting what to fix.', 'note.min' => 'Write a little more so Accounting knows what to fix.']);
        $r = $this->signoff->sendBack($report, trim($data['note']), $request->user(), $request->attributes->get('company'), $request->ip());

        return response()->json(['data' => ['id' => $r->id, 'signoff_status' => $r->signoff_status]]);
    }

    public function pdf(Request $request, int $report): Response
    {
        $r = $this->find($request, $report);
        AuditTrail::record([
            'user_id' => $request->user()->id, 'company_id' => $r->company_id, 'action' => 'report_downloaded',
            'table_name' => 'financial_reports', 'record_id' => $r->id, 'new_values' => ['format' => 'pdf', 'title' => $r->title],
            'ip_address' => $request->ip(),
        ]);

        return Pdf::loadView('pdf.report', ['report' => ReportDirectory::present($r, full: true), 'company' => $request->attributes->get('company')])
            ->setPaper('a4')->download(str($r->title)->slug().'.pdf');
    }

    private function find(Request $request, int $id): FinancialReport
    {
        return FinancialReport::query()->where('company_id', $request->attributes->get('company')->id)
            ->with(['department:id,name', 'generator:id,first_name,last_name', 'signer:id,first_name,last_name'])->findOrFail($id);
    }
}
