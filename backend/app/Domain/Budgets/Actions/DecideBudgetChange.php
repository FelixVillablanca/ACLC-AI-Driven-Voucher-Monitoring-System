<?php

namespace App\Domain\Budgets\Actions;

use App\Domain\Audit\AuditTrail;
use App\Domain\Budgets\Support\FiscalYear;
use App\Exceptions\ApiException;
use App\Models\BudgetAllocation;
use App\Models\BudgetChangeRequest;
use App\Models\Company;
use App\Models\Department;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * The Supervisor's budget sign-off (Framer adI8wBXHd Budgets overview, KHqkVA77a Approve top-up), 2026-11-27.
 * An Accounting Officer's budget change bigger than the Global setting "budget.change_signoff_above" waits as a
 * pending `budget_change_requests` row (SaveBudget::update). Here a Supervisor decides it, in ONE transaction:
 *   approve   applies the new amount (the requested one, or a smaller change in the same direction) and the requested
 *             alert %; the request becomes approved; audit `budget_change_approved`; the officer gets a bell notice.
 *   decline   a note is required; the budget stays as it is; audit `budget_change_declined`; bell notice.
 * 409 REQUEST_ALREADY_DECIDED (someone decided / the officer cancelled first), 409 BUDGET_CHANGED (the budget isn't
 * what the request was made against), 403 SELF_SIGNOFF (never sign off your own request).
 */
class DecideBudgetChange
{
    public function __construct(private ConsumeBudget $consume) {}

    public function approve(int $requestId, ?string $approvedBudget, ?string $note, User $supervisor, Company $company, ?string $ip): BudgetChangeRequest
    {
        return DB::transaction(function () use ($requestId, $approvedBudget, $note, $supervisor, $company, $ip) {
            [$request, $budget] = $this->lock($requestId, $supervisor, $company);

            $from = (string) $request->current_budget;
            $asked = (string) $request->requested_budget;
            $total = $approvedBudget !== null ? bcadd($approvedBudget, '0', 2) : $asked;
            // Any amount from "just past the current budget" up to what was asked, in the direction asked
            $up = bccomp($asked, $from, 2) >= 0;
            $ok = $up ? (bccomp($total, $from, 2) > 0 && bccomp($total, $asked, 2) <= 0)
                : (bccomp($total, $from, 2) < 0 && bccomp($total, $asked, 2) >= 0);
            if (bccomp($asked, $from, 2) === 0) {
                $ok = bccomp($total, $asked, 2) === 0; // only the alert % changes
            }
            if (! $ok) {
                throw ValidationException::withMessages(['approved_budget' => [$up
                    ? 'Approve more than ₱'.number_format((float) $from, 2).' and at most the ₱'.number_format((float) $asked, 2).' asked for.'
                    : 'Approve less than ₱'.number_format((float) $from, 2).' and at least the ₱'.number_format((float) $asked, 2).' asked for.']]);
            }

            $old = ['total_budget' => (string) $budget->total_budget, 'alert_threshold_pct' => (string) $budget->alert_threshold_pct];
            $before = $budget->usedPct();
            $budget->forceFill(['total_budget' => $total, 'alert_threshold_pct' => $request->requested_alert_pct, 'updated_by' => $supervisor->id])->save();
            $request->forceFill(['status' => 'approved', 'decided_by' => $supervisor->id, 'decided_at' => now(), 'decision_note' => $note ?: null])->save();

            AuditTrail::record([
                'user_id' => $supervisor->id, 'company_id' => $company->id, 'action' => 'budget_change_approved',
                'table_name' => 'budget_allocations', 'record_id' => $budget->id,
                'old_values' => $old,
                'new_values' => ['total_budget' => $total, 'alert_threshold_pct' => (string) $request->requested_alert_pct,
                    'request_id' => $request->id, 'requested_budget' => $asked, 'reason' => $note ?: $request->reason],
                'ip_address' => $ip,
            ]);
            $this->consume->checkAlert($budget, $company, $before);

            $partly = bccomp($total, $asked, 2) !== 0;
            $this->notify($request, $budget, $company,
                'Budget change approved'.($partly ? ' (a smaller amount)' : '').': '.$this->department($budget),
                $supervisor->full_name.' approved the '.FiscalYear::label($company, $budget->fiscal_year).' budget at ₱'
                .number_format((float) $total, 2).($partly ? ' (you asked for ₱'.number_format((float) $asked, 2).')' : '')
                .'.'.($note ? ' “'.mb_strimwidth($note, 0, 160, '…').'”' : ''));

            return $request->fresh();
        });
    }

    public function decline(int $requestId, string $note, User $supervisor, Company $company, ?string $ip): BudgetChangeRequest
    {
        return DB::transaction(function () use ($requestId, $note, $supervisor, $company, $ip) {
            [$request, $budget] = $this->lock($requestId, $supervisor, $company, checkBudget: false);
            $request->forceFill(['status' => 'declined', 'decided_by' => $supervisor->id, 'decided_at' => now(), 'decision_note' => $note])->save();

            AuditTrail::record([
                'user_id' => $supervisor->id, 'company_id' => $company->id, 'action' => 'budget_change_declined',
                'table_name' => 'budget_allocations', 'record_id' => $budget->id,
                'old_values' => ['request_id' => $request->id, 'status' => 'pending'],
                'new_values' => ['request_id' => $request->id, 'status' => 'declined', 'requested_budget' => (string) $request->requested_budget, 'reason' => $note],
                'ip_address' => $ip,
            ]);
            $this->notify($request, $budget, $company, 'Budget change declined: '.$this->department($budget),
                $supervisor->full_name.' declined the change to ₱'.number_format((float) $request->requested_budget, 2)
                .'. The budget stays at ₱'.number_format((float) $budget->total_budget, 2).'. “'.mb_strimwidth($note, 0, 160, '…').'”');

            return $request->fresh();
        });
    }

    /** @return array{0: BudgetChangeRequest, 1: BudgetAllocation} */
    private function lock(int $requestId, User $supervisor, Company $company, bool $checkBudget = true): array
    {
        /** @var BudgetChangeRequest $request */
        $request = BudgetChangeRequest::query()->where('company_id', $company->id)->whereKey($requestId)->lockForUpdate()->firstOrFail();
        if ($request->status !== 'pending') {
            throw new ApiException('This request was already '.$request->status.'. The list is refreshed.', 'REQUEST_ALREADY_DECIDED', 409);
        }
        if ((int) $request->requested_by === (int) $supervisor->id) {
            throw new ApiException('You asked for this change, so another Supervisor has to decide on it.', 'SELF_SIGNOFF', 403);
        }
        /** @var BudgetAllocation $budget */
        $budget = BudgetAllocation::query()->where('company_id', $company->id)->whereKey($request->budget_allocation_id)->lockForUpdate()->firstOrFail();
        if ($checkBudget && bccomp((string) $budget->total_budget, (string) $request->current_budget, 2) !== 0) {
            throw new ApiException('This budget changed after the request was made. Decline it and ask Accounting to send a new one.', 'BUDGET_CHANGED', 409);
        }

        return [$request, $budget];
    }

    private function notify(BudgetChangeRequest $request, BudgetAllocation $budget, Company $company, string $title, string $message): void
    {
        if (! $request->requested_by) {
            return;
        }
        Notification::create([
            'recipient_id' => $request->requested_by,
            'type' => 'budget_change',
            'title' => $title,
            'message' => $message." ({$company->name})",
        ]);
    }

    private function department(BudgetAllocation $budget): string
    {
        return (string) Department::query()->whereKey($budget->department_id)->value('name');
    }
}
