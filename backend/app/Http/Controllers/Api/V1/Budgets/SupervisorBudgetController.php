<?php

namespace App\Http\Controllers\Api\V1\Budgets;

use App\Domain\AI\Forecasting\ForecastBoard;
use App\Domain\AI\Forecasting\GenerateForecasts;
use App\Domain\Budgets\Actions\DecideBudgetChange;
use App\Domain\Budgets\Queries\BudgetBoard;
use App\Domain\Budgets\Support\FiscalYear;
use App\Http\Controllers\Controller;
use App\Http\Requests\Budgets\DecideBudgetChangeRequest;
use App\Models\BudgetAllocation;
use App\Models\BudgetChangeRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Throwable;

/**
 * The Supervisor / Manager's Budgets (2026-11-27; Framer adI8wBXHd overview, KHqkVA77a approve top-up).
 * Company = X-Company-ID (role:supervisor_manager + company). Read-only budgets + the sign-off of Accounting's
 * pending changes. Another company's request = 404.
 *   GET  /supervisor/budgets?year=                         overview (same numbers as Accounting's) + pending requests
 *   POST /supervisor/budgets/requests/{id}/approve         approved_budget?, note?
 *   POST /supervisor/budgets/requests/{id}/decline         note
 */
class SupervisorBudgetController extends Controller
{
    public function __construct(private DecideBudgetChange $decide) {}

    public function index(Request $request): JsonResponse
    {
        $company = $request->attributes->get('company');
        $board = new BudgetBoard($company, $request->user());
        $overview = $board->overview($this->year($request));
        $requests = $this->pending($request);

        return response()->json(['data' => $overview + [
            'requests' => $requests,
            'requests_up_total' => array_reduce($requests, fn ($c, $r) => bccomp($r['change'], '0', 2) > 0 ? bcadd($c, $r['change'], 2) : $c, '0.00'),
        ]]);
    }

    public function approve(DecideBudgetChangeRequest $request, int $changeRequest): JsonResponse
    {
        $r = $this->decide->approve($changeRequest, $request->validated('approved_budget'), $request->validated('note'),
            $request->user(), $request->attributes->get('company'), $request->ip());

        return response()->json(['data' => ['id' => $r->id, 'status' => $r->status, 'budget_allocation_id' => $r->budget_allocation_id]]);
    }

    public function decline(DecideBudgetChangeRequest $request, int $changeRequest): JsonResponse
    {
        $r = $this->decide->decline($changeRequest, $request->validated('note'), $request->user(), $request->attributes->get('company'), $request->ip());

        return response()->json(['data' => ['id' => $r->id, 'status' => $r->status]]);
    }

    /** Every pending request of the company (any fiscal year), oldest first, with what approving it would do. */
    private function pending(Request $request): array
    {
        $company = $request->attributes->get('company');
        $rows = BudgetChangeRequest::query()->where('company_id', $company->id)->where('status', 'pending')
            ->with(['allocation.department:id,name', 'requester:id,first_name,last_name'])->orderBy('created_at')->get();
        $risk = $rows->isEmpty() ? collect() : $this->forecastRisk($request);

        return $rows->map(function (BudgetChangeRequest $r) use ($request, $company, $risk) {
            /** @var BudgetAllocation $b */
            $b = $r->allocation;
            $used = (string) $b->used_amount;
            $forecast = (int) $b->fiscal_year === FiscalYear::current($company) ? ($risk[$b->department_id] ?? null) : null;

            return [
                'id' => $r->id,
                'budget_id' => $b->id,
                'department' => ['id' => $b->department_id, 'name' => $b->department?->name],
                'fiscal_year' => (int) $b->fiscal_year,
                'fiscal_label' => FiscalYear::label($company, (int) $b->fiscal_year),
                'current_budget' => (string) $r->current_budget,
                'requested_budget' => (string) $r->requested_budget,
                'change' => bcsub((string) $r->requested_budget, (string) $r->current_budget, 2),
                'current_alert_pct' => (float) $r->current_alert_pct,
                'requested_alert_pct' => (float) $r->requested_alert_pct,
                'budget_now' => (string) $b->total_budget, // ≠ current_budget = the budget moved since (approve → 409)
                'used' => $used,
                'used_pct' => BudgetAllocation::pct($used, (string) $b->total_budget, 1),
                'after_pct' => BudgetAllocation::pct($used, (string) $r->requested_budget, 1),
                'reason' => $r->reason,
                'requested_by' => $r->requester ? trim($r->requester->first_name.' '.$r->requester->last_name) : null,
                'mine' => (int) $r->requested_by === (int) $request->user()->id,
                'created_at' => $r->created_at?->toIso8601String(),
                // the stored forecast for this department (linear trend until the ML model): what it expects to spend
                'forecast' => $forecast ? [
                    'expected' => $forecast['expected'], 'until' => $forecast['until'],
                    'left_after' => bcsub((string) $r->requested_budget, $used, 2),
                ] : null,
            ];
        })->all();
    }

    /** department id → the forecast risk (expected spending until the end of the 3-month window / fiscal year). Never fails the page. */
    private function forecastRisk(Request $request): array
    {
        try {
            $rows = (new ForecastBoard($request->attributes->get('company'), app(GenerateForecasts::class)))->overview(3)['rows'];
        } catch (Throwable $e) {
            report($e);

            return [];
        }

        return collect($rows)->filter(fn ($r) => $r['risk']['expected'] !== null)
            ->mapWithKeys(fn ($r) => [$r['department']['id'] => $r['risk']])->all();
    }

    private function year(Request $request): int
    {
        $current = FiscalYear::current($request->attributes->get('company'));
        $year = filter_var($request->query('year'), FILTER_VALIDATE_INT);

        return $year !== false && $year >= 2000 && $year <= $current + 5 ? $year : $current;
    }
}
