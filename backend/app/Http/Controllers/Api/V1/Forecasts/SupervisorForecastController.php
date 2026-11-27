<?php

namespace App\Http\Controllers\Api\V1\Forecasts;

use App\Domain\AI\Forecasting\ForecastBoard;
use App\Domain\AI\Forecasting\GenerateForecasts;
use App\Http\Controllers\Controller;
use App\Models\BudgetChangeRequest;
use App\Models\Department;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * The Supervisor / Manager's Forecasts (2026-11-27; Framer wY0BB3HcK). Read-only, company = X-Company-ID
 * (role:supervisor_manager + company). The same stored forecasts Accounting sees (linear trend until the ML model).
 *   GET /supervisor/forecasts                    the whole company: chart, next month, year-end projection, departments
 *   GET /supervisor/forecasts?department={id}    one department (another company's = 404)
 * Both add `year_end` (ForecastBoard::yearEnd), `departments` (for the picker) and `pending_requests` (budget changes
 * waiting for a Supervisor: the "Review top-ups" link).
 */
class SupervisorForecastController extends Controller
{
    private const MONTHS = 3;

    public function __construct(private GenerateForecasts $generator) {}

    public function index(Request $request): JsonResponse
    {
        $request->validate(['department' => ['sometimes', 'nullable', 'integer', 'min:1']]);
        $company = $request->attributes->get('company');
        $board = new ForecastBoard($company, $this->generator);
        $board->ensureFresh(); // works out this month's forecasts if they're missing (same as Accounting's page)
        $departmentId = $request->integer('department') ?: null;

        $data = $departmentId ? $board->department($departmentId, self::MONTHS) : $board->overview(self::MONTHS);
        $pending = BudgetChangeRequest::query()->where('company_id', $company->id)->where('status', 'pending')
            ->with('allocation.department:id,name')->get();

        return response()->json(['data' => $data + [
            'view' => $departmentId ? 'department' : 'company',
            'year_end' => $board->yearEnd($departmentId),
            'departments' => Department::query()->where('company_id', $company->id)
                ->where(fn ($q) => $q->where('is_active', true)->when($departmentId, fn ($w) => $w->orWhere('id', $departmentId)))
                ->orderBy('name')->get(['id', 'name'])->map(fn ($d) => ['id' => $d->id, 'name' => $d->name])->all(),
            'pending_requests' => [
                'count' => $pending->count(),
                'departments' => $pending->map(fn ($r) => $r->allocation?->department_id)->filter()->unique()->values()->all(),
            ],
        ]]);
    }
}
