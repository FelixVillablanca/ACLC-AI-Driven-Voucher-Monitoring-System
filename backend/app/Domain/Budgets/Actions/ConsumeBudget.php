<?php

namespace App\Domain\Budgets\Actions;

use App\Domain\Budgets\Support\FiscalYear;
use App\Domain\Vouchers\VoucherStatus as S;
use App\Models\BudgetAllocation;
use App\Models\Company;
use App\Models\Department;
use App\Models\Notification;
use App\Models\User;
use App\Models\Voucher;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Budget CONSUMPTION (2026-11-27). Call inside the transaction that gives a voucher its FINAL approval:
 * the department's budget for the fiscal year of approved_at is LOCKED (lockForUpdate, so two approvals at
 * the same moment can't both read the old number) and the voucher's amount is added to used_amount.
 * Going over budget never blocks (user decision): Accounting already saw the warning on the review page.
 * When usage passes the alert % (or 100%) the company's Accounting Officers and the department head get a
 * budget_alert bell notice, once per crossing (alert_sent_at).
 */
class ConsumeBudget
{
    public function consume(Voucher $voucher, Company $company): void
    {
        if (! $voucher->department_id || $voucher->status !== S::Approved->value) {
            return;
        }
        $year = FiscalYear::of($company, Carbon::parse($voucher->approved_at ?? now()));
        $budget = BudgetAllocation::query()->where('company_id', $company->id)->where('department_id', $voucher->department_id)
            ->where('fiscal_year', $year)->lockForUpdate()->first();
        if (! $budget) {
            return; // no budget set for that year: the spending is counted when one is allocated (usedFor)
        }

        $before = $budget->usedPct();
        $budget->used_amount = bcadd((string) $budget->used_amount, (string) $voucher->amount, 2);
        $budget->save();
        $this->checkAlert($budget, $company, $before, $voucher);
    }

    /** Approved spending of a department in a fiscal year (what used_amount must be when a budget is created). */
    public static function usedFor(Company $company, int $departmentId, int $year): string
    {
        [$from, $to] = FiscalYear::range($company, $year);

        return (string) DB::table('vouchers')->where('company_id', $company->id)->where('department_id', $departmentId)
            ->where('status', S::Approved->value)->whereBetween('approved_at', [$from, $to])
            ->selectRaw('COALESCE(SUM(amount), 0) as t')->value('t');
    }

    /**
     * After usage or the budget / alert % changed: below the alert % → alert_sent_at cleared (it can alert again);
     * at or over it for the first time → alert_sent_at set + bell notices. $before = usage % before the change.
     */
    public function checkAlert(BudgetAllocation $budget, Company $company, float $before, ?Voucher $voucher = null): void
    {
        $after = $budget->usedPct();
        $alert = (float) $budget->alert_threshold_pct;

        if ($after < $alert) {
            if ($budget->alert_sent_at) {
                $budget->forceFill(['alert_sent_at' => null])->save();
            }

            return;
        }
        $crossedAlert = ! $budget->alert_sent_at;
        $crossedFull = $before < 100 && $after >= 100;
        if ($crossedAlert) {
            $budget->forceFill(['alert_sent_at' => now()])->save();
        }
        if ($crossedAlert || $crossedFull) {
            $this->notify($budget, $company, $after, $crossedFull, $voucher);
        }
    }

    private function notify(BudgetAllocation $budget, Company $company, float $pct, bool $over, ?Voucher $voucher): void
    {
        $department = Department::find($budget->department_id);
        $label = FiscalYear::label($company, $budget->fiscal_year);
        $recipients = self::recipients($company, $department);
        $pctText = rtrim(rtrim(number_format($pct, 1, '.', ''), '0'), '.');
        $alertText = rtrim(rtrim((string) $budget->alert_threshold_pct, '0'), '.');

        foreach ($recipients as $id) {
            Notification::create([
                'recipient_id' => $id,
                'type' => 'budget_alert',
                'title' => $over
                    ? "{$department?->name} is over its {$label} budget"
                    : "{$department?->name} passed its budget alert ({$alertText}%)",
                'message' => "{$company->name}: {$pctText}% of the {$label} budget is used"
                    .($voucher ? " after {$voucher->voucher_number} was approved." : '.'),
                'voucher_id' => $voucher?->id,
            ]);
        }
    }

    /** @return list<int> the company's active Accounting Officers + the department head (if active) */
    public static function recipients(Company $company, ?Department $department): array
    {
        $ids = User::query()->where('role', 'accounting_officer')->where('is_active', true)
            ->whereHas('accessibleCompanies', fn ($q) => $q->where('companies.id', $company->id)->where('user_company_access.granted_status', 'accepted'))
            ->pluck('id')->all();
        if ($department?->head_user_id && User::whereKey($department->head_user_id)->where('is_active', true)->exists()) {
            $ids[] = (int) $department->head_user_id;
        }

        return array_values(array_unique(array_map('intval', $ids)));
    }
}
