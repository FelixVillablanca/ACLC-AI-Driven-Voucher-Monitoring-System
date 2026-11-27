<?php

namespace App\Http\Controllers\Api\V1\Forecasts;

use App\Domain\AI\Forecasting\ForecastBoard;
use App\Domain\AI\Forecasting\GenerateForecasts;
use App\Domain\Audit\AuditTrail;
use App\Http\Controllers\Controller;
use App\Support\Exports\TabularExport;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Carbon;

/**
 * The Accounting Officer's Forecasts (2026-11-27; Framer GWmqqOmd7 overview, sjtX1kKqt department).
 * Company = X-Company-ID (role:accounting_officer + company). Another company's department = 404.
 *   GET  /officer/forecasts?months=1..3                  overview (works out this month's forecasts if missing)
 *   GET  /officer/forecasts/departments/{id}?months=     one department
 *   POST /officer/forecasts/recalculate                  work them out again now (6/min)
 *   GET  /officer/forecasts/export?months=&format=csv|xlsx
 */
class ForecastController extends Controller
{
    public function __construct(private GenerateForecasts $generator) {}

    public function index(Request $request): JsonResponse
    {
        $board = $this->board($request);
        $board->ensureFresh();

        return response()->json(['data' => $board->overview($this->months($request))]);
    }

    public function department(Request $request, int $department): JsonResponse
    {
        $board = $this->board($request);
        $board->ensureFresh();

        return response()->json(['data' => $board->department($department, $this->months($request))]);
    }

    public function recalculate(Request $request): JsonResponse
    {
        $rows = $this->generator->forCompany($request->attributes->get('company'));

        return response()->json(['data' => ['rows' => $rows, 'generated_at' => now()->toIso8601String()]]);
    }

    public function export(Request $request, TabularExport $export): Response
    {
        $request->validate(['format' => ['nullable', 'in:csv,xlsx'], 'months' => ['nullable', 'integer', 'between:1,3']]);
        $board = $this->board($request);
        $board->ensureFresh();
        $data = $board->overview($months = $this->months($request));
        $company = $request->attributes->get('company');

        $risk = ['over' => 'Over budget', 'tight' => 'Tight', 'on_track' => 'On track', 'no_budget' => 'No budget', 'no_forecast' => 'Not enough history'];
        $rows = collect($data['rows'])->map(fn ($r) => [
            $r['department']['name'],
            $r['forecast'] ? (float) $r['forecast']['predicted'] : '',
            $r['forecast'] ? (float) $r['forecast']['lower'] : '',
            $r['forecast'] ? (float) $r['forecast']['upper'] : '',
            $r['forecast'] ? $r['forecast']['confidence'].'%' : '',
            $r['risk']['budget_left'] !== null ? (float) $r['risk']['budget_left'] : '',
            $r['risk']['expected'] !== null ? (float) $r['risk']['expected'] : '',
            $risk[$r['risk']['level']],
            $r['months_used'],
        ])->all();
        $headers = ['Department', "Forecast next {$months} month(s) (PHP)", 'Low (PHP)', 'High (PHP)', 'Confidence',
            'Budget left (PHP)', 'Expected until '.($data['rows'][0]['risk']['until'] ?? 'year end').' (PHP)', 'Risk', 'Months of history'];
        $format = $request->query('format', 'csv');

        AuditTrail::record([
            'user_id' => $request->user()->id, 'company_id' => $company->id, 'action' => 'forecasts_exported',
            'table_name' => 'ai_forecasts', 'new_values' => ['format' => $format, 'months' => $months, 'count' => count($rows)],
            'ip_address' => $request->ip(),
        ]);
        $name = 'forecast-'.str($company->name)->slug().'-'.Carbon::now()->format('Y-m-d').'.'.$format;

        return response($format === 'xlsx' ? $export->xlsx('Forecast', $headers, $rows) : $export->csv($headers, $rows), 200, [
            'Content-Type' => $format === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="'.$name.'"',
        ]);
    }

    private function board(Request $request): ForecastBoard
    {
        return new ForecastBoard($request->attributes->get('company'), $this->generator);
    }

    /** ?months=1..3 (default 3) */
    private function months(Request $request): int
    {
        $m = filter_var($request->query('months'), FILTER_VALIDATE_INT);

        return $m !== false && $m >= 1 && $m <= GenerateForecasts::HORIZON ? $m : GenerateForecasts::HORIZON;
    }
}
