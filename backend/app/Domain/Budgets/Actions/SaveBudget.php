<?php

namespace App\Domain\Budgets\Actions;

use App\Domain\Approvals\Support\ApprovalRoute;
use App\Domain\Audit\AuditTrail;
use App\Domain\Budgets\Support\FiscalYear;
use App\Domain\Platform\SystemSettings;
use App\Exceptions\ApiException;
use App\Models\BudgetAllocation;
use App\Models\BudgetChangeRequest;
use App\Models\Company;
use App\Models\Department;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * The Accounting Officer's budget changes (Framer AwnFnuBYJ "+ Allocate budget", MGf9CXv2s Edit allocation),
 * 2026-11-27. Every change is ONE transaction with an audit row (table budget_allocations).
 *   allocate   a department's budget for a fiscal year (one per department + year: 409 BUDGET_EXISTS).
 *              Applies at once; "Used" starts at what the department already spent that year.
 *   update     new amount and/or alert %. A change of the amount bigger than the Global setting
 *              "budget.change_signoff_above" (₱250,000) is NOT applied: it becomes a pending request for a
 *              Supervisor (bell notice) → returns ['applied' => false]. Only one pending request per budget
 *              (409 BUDGET_REQUEST_PENDING). Stale form (was_total / was_alert_pct differ) → 409 BUDGET_CHANGED.
 *   cancel     the officer who asked takes back a pending request.
 */
class SaveBudget
{
    public function __construct(private ConsumeBudget $consume, private SystemSettings $settings) {}

    public function signoffAbove(): string
    {
        return (string) $this->settings->value(SystemSettings::BUDGET_CHANGE_SIGNOFF_ABOVE);
    }

    /** @param array{department_id: int, fiscal_year: int, total_budget: string, alert_threshold_pct: numeric, reason?: ?string} $data */
    public function allocate(array $data, User $officer, Company $company, ?string $ip): BudgetAllocation
    {
        return DB::transaction(function () use ($data, $officer, $company, $ip) {
            $department = Department::query()->where('company_id', $company->id)->whereKey($data['department_id'])->lockForUpdate()->firstOrFail();
            $exists = BudgetAllocation::query()->where('company_id', $company->id)->where('department_id', $department->id)
                ->where('fiscal_year', $data['fiscal_year'])->lockForUpdate()->exists();
            if ($exists) {
                throw new ApiException("{$department->name} already has a ".FiscalYear::label($company, (int) $data['fiscal_year']).' budget. Edit it instead.', 'BUDGET_EXISTS', 409);
            }

            $budget = BudgetAllocation::create([
                'company_id' => $company->id,
                'department_id' => $department->id,
                'fiscal_year' => (int) $data['fiscal_year'],
                'total_budget' => $data['total_budget'],
                'used_amount' => ConsumeBudget::usedFor($company, $department->id, (int) $data['fiscal_year']),
                'alert_threshold_pct' => $data['alert_threshold_pct'],
                'created_by' => $officer->id,
                'updated_by' => $officer->id,
            ]);
            $this->audit($officer, $company, 'budget_allocated', $budget, null, $this->values($budget), $ip, $data['reason'] ?? null);
            $this->consume->checkAlert($budget, $company, 0.0);

            return $budget;
        });
    }

    /**
     * @param  array{total_budget: string, alert_threshold_pct: numeric, reason: string, was_total: string, was_alert_pct: numeric}  $data
     * @return array{applied: bool, budget: BudgetAllocation, request: ?BudgetChangeRequest}
     */
    public function update(int $budgetId, array $data, User $officer, Company $company, ?string $ip): array
    {
        $result = DB::transaction(function () use ($budgetId, $data, $officer, $company, $ip) {
            /** @var BudgetAllocation $budget */
            $budget = BudgetAllocation::query()->where('company_id', $company->id)->whereKey($budgetId)->lockForUpdate()->firstOrFail();
            // optimistic concurrency: the form sends the numbers it showed ("was"); someone else changed them → 409
            if (bccomp((string) $data['was_total'], (string) $budget->total_budget, 2) !== 0
                || bccomp((string) $data['was_alert_pct'], (string) $budget->alert_threshold_pct, 2) !== 0) {
                throw new ApiException('Someone changed this budget while you were editing. The latest numbers are loaded: check them and try again.', 'BUDGET_CHANGED', 409);
            }
            if (BudgetChangeRequest::query()->where('budget_allocation_id', $budget->id)->where('status', 'pending')->exists()) {
                throw new ApiException('A change to this budget is already waiting for Supervisor sign-off. Cancel it first, or wait for the decision.', 'BUDGET_REQUEST_PENDING', 409);
            }

            $newTotal = bcadd((string) $data['total_budget'], '0', 2);
            $newAlert = bcadd((string) $data['alert_threshold_pct'], '0', 2);
            $sameTotal = bccomp($newTotal, (string) $budget->total_budget, 2) === 0;
            if ($sameTotal && bccomp($newAlert, (string) $budget->alert_threshold_pct, 2) === 0) {
                throw new ApiException('Nothing changed: the amount and the alert % are the same as now.', 'NOTHING_CHANGED', 409);
            }

            $diff = ltrim(bcsub($newTotal, (string) $budget->total_budget, 2), '-');
            if (bccomp($diff, $this->signoffAbove(), 2) > 0) {
                return ['applied' => false, 'budget' => $budget, 'request' => $this->request($budget, $newTotal, $newAlert, $data['reason'], $officer, $company, $ip)];
            }

            $old = $this->values($budget);
            $before = $budget->usedPct();
            $budget->forceFill(['total_budget' => $newTotal, 'alert_threshold_pct' => $newAlert, 'updated_by' => $officer->id])->save();
            $this->audit($officer, $company, 'budget_updated', $budget, $old, $this->values($budget), $ip, $data['reason']);
            $this->consume->checkAlert($budget, $company, $before);

            return ['applied' => true, 'budget' => $budget->fresh(), 'request' => null];
        });

        return $result;
    }

    public function cancelRequest(int $requestId, User $officer, Company $company, ?string $ip): BudgetChangeRequest
    {
        return DB::transaction(function () use ($requestId, $officer, $company, $ip) {
            /** @var BudgetChangeRequest $request */
            $request = BudgetChangeRequest::query()->where('company_id', $company->id)->whereKey($requestId)->lockForUpdate()->firstOrFail();
            if ($request->status !== 'pending') {
                throw new ApiException('This request was already '.$request->status.'.', 'REQUEST_ALREADY_DECIDED', 409);
            }
            if ((int) $request->requested_by !== (int) $officer->id) {
                throw new ApiException('Only the officer who asked for this change can cancel it.', 'NOT_YOUR_REQUEST', 403);
            }
            $request->forceFill(['status' => 'cancelled', 'decided_by' => $officer->id, 'decided_at' => now()])->save();
            AuditTrail::record([
                'user_id' => $officer->id, 'company_id' => $company->id, 'action' => 'budget_change_cancelled',
                'table_name' => 'budget_allocations', 'record_id' => $request->budget_allocation_id,
                'old_values' => ['request_id' => $request->id, 'status' => 'pending'],
                'new_values' => ['request_id' => $request->id, 'status' => 'cancelled'],
                'ip_address' => $ip,
            ]);

            return $request;
        });
    }

    private function request(BudgetAllocation $budget, string $total, string $alert, string $reason, User $officer, Company $company, ?string $ip): BudgetChangeRequest
    {
        $request = BudgetChangeRequest::create([
            'company_id' => $company->id,
            'budget_allocation_id' => $budget->id,
            'current_budget' => $budget->total_budget,
            'requested_budget' => $total,
            'current_alert_pct' => $budget->alert_threshold_pct,
            'requested_alert_pct' => $alert,
            'reason' => $reason,
            'status' => 'pending',
            'requested_by' => $officer->id,
        ]);
        AuditTrail::record([
            'user_id' => $officer->id, 'company_id' => $company->id, 'action' => 'budget_change_requested',
            'table_name' => 'budget_allocations', 'record_id' => $budget->id,
            'old_values' => $this->values($budget),
            'new_values' => ['total_budget' => $total, 'alert_threshold_pct' => $alert, 'request_id' => $request->id, 'reason' => $reason],
            'ip_address' => $ip,
        ]);

        $department = Department::find($budget->department_id);
        foreach (ApprovalRoute::supervisorsOf($company) as $supervisor) {
            Notification::create([
                'recipient_id' => $supervisor->id,
                'type' => 'budget_change',
                'title' => "Budget change needs your sign-off: {$department?->name}",
                'message' => "{$officer->full_name} (Accounting) asks to change the ".FiscalYear::label($company, $budget->fiscal_year)
                    .' budget from ₱'.number_format((float) $budget->total_budget, 2).' to ₱'.number_format((float) $total, 2)
                    ." in {$company->name}. “".mb_strimwidth($reason, 0, 160, '…').'”',
            ]);
        }

        return $request;
    }

    private function values(BudgetAllocation $b): array
    {
        return [
            'department_id' => $b->department_id,
            'fiscal_year' => $b->fiscal_year,
            'total_budget' => (string) $b->total_budget,
            'alert_threshold_pct' => (string) $b->alert_threshold_pct,
        ];
    }

    private function audit(User $by, Company $company, string $action, BudgetAllocation $b, ?array $old, array $new, ?string $ip, ?string $reason): void
    {
        AuditTrail::record([
            'user_id' => $by->id, 'company_id' => $company->id, 'action' => $action,
            'table_name' => 'budget_allocations', 'record_id' => $b->id,
            'old_values' => $old, 'new_values' => $new + ($reason ? ['reason' => $reason] : []),
            'ip_address' => $ip,
        ]);
    }
}
