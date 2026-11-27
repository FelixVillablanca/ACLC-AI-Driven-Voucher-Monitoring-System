<?php

namespace App\Http\Controllers\Api\V1\Budgets;

use App\Domain\Budgets\Actions\SaveBudget;
use App\Domain\Budgets\Queries\BudgetBoard;
use App\Domain\Budgets\Support\FiscalYear;
use App\Http\Controllers\Controller;
use App\Http\Requests\Budgets\SaveBudgetRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * The Accounting Officer's Budgets (2026-11-27; Framer AwnFnuBYJ overview, kpJmhDxKE department, MGf9CXv2s edit).
 * Company = X-Company-ID (role:accounting_officer + company). Another company's department / budget = 404.
 *   GET    /officer/budgets?year=                  overview
 *   GET    /officer/budgets/departments/{id}?year= one department
 *   POST   /officer/budgets                        allocate (201)
 *   PATCH  /officer/budgets/{id}                   edit: 200 applied, or 202 sent for Supervisor sign-off
 *   DELETE /officer/budgets/requests/{id}          cancel your pending sign-off request
 */
class BudgetController extends Controller
{
    public function __construct(private SaveBudget $save) {}

    public function index(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->board($request)->overview($this->year($request))]);
    }

    public function department(Request $request, int $department): JsonResponse
    {
        return response()->json(['data' => $this->board($request)->department($department, $this->year($request))]);
    }

    public function store(SaveBudgetRequest $request): JsonResponse
    {
        $budget = $this->save->allocate($request->validated(), $request->user(), $request->attributes->get('company'), $request->ip());

        return response()->json(['data' => ['id' => $budget->id, 'department_id' => $budget->department_id, 'fiscal_year' => $budget->fiscal_year]], 201);
    }

    public function update(SaveBudgetRequest $request, int $budget): JsonResponse
    {
        $result = $this->save->update($budget, $request->validated(), $request->user(), $request->attributes->get('company'), $request->ip());

        return response()->json(['data' => [
            'applied' => $result['applied'],
            'id' => $result['budget']->id,
            'request_id' => $result['request']?->id,
            'signoff_above' => $this->save->signoffAbove(),
        ]], $result['applied'] ? 200 : 202);
    }

    public function cancelRequest(Request $request, int $changeRequest): JsonResponse
    {
        $this->save->cancelRequest($changeRequest, $request->user(), $request->attributes->get('company'), $request->ip());

        return response()->json(['data' => ['cancelled' => true]]);
    }

    private function board(Request $request): BudgetBoard
    {
        return new BudgetBoard($request->attributes->get('company'), $request->user());
    }

    /** ?year= when it's a sensible fiscal year, else the current one. */
    private function year(Request $request): int
    {
        $current = FiscalYear::current($request->attributes->get('company'));
        $year = filter_var($request->query('year'), FILTER_VALIDATE_INT);

        return $year !== false && $year >= 2000 && $year <= $current + 5 ? $year : $current;
    }
}
