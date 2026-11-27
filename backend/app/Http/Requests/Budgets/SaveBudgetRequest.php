<?php

namespace App\Http\Requests\Budgets;

use App\Domain\Budgets\Support\FiscalYear;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * POST  /api/v1/officer/budgets          allocate: department_id, fiscal_year, total_budget, alert_threshold_pct, reason?
 * PATCH /api/v1/officer/budgets/{id}     edit:     total_budget, alert_threshold_pct, reason (required), was_total, was_alert_pct
 * Money: up to 2 decimals, never through a float (sent as text, e.g. "1600000.00"). Alert % 50–100.
 * fiscal_year: last year, this one or the next (company's fiscal year). The department must be an active one
 * of the company in X-Company-ID.
 */
class SaveBudgetRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // role:accounting_officer + company middleware
    }

    protected function prepareForValidation(): void
    {
        $clean = [];
        if (is_string($this->total_budget)) {
            $clean['total_budget'] = str_replace([',', '₱', ' '], '', $this->total_budget);
        }
        if (is_string($this->reason)) {
            $clean['reason'] = trim($this->reason) ?: null;
        }
        $this->merge($clean);
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        $money = ['required', 'numeric', 'min:1', 'max:9999999999999.99', 'decimal:0,2'];
        $alert = ['required', 'numeric', 'min:50', 'max:100'];

        if ($this->isMethod('patch')) {
            return [
                'total_budget' => $money,
                'alert_threshold_pct' => $alert,
                'reason' => ['required', 'string', 'min:5', 'max:500'],
                'was_total' => ['required', 'numeric'],     // what the form showed (409 BUDGET_CHANGED if it's not current)
                'was_alert_pct' => ['required', 'numeric'],
            ];
        }
        $company = $this->attributes->get('company');
        $current = FiscalYear::current($company);

        return [
            'department_id' => ['required', 'integer', Rule::exists('departments', 'id')->where('company_id', $company->id)->where('is_active', true)],
            'fiscal_year' => ['required', 'integer', 'between:'.($current - 1).','.($current + 1)],
            'total_budget' => $money,
            'alert_threshold_pct' => $alert,
            'reason' => ['nullable', 'string', 'max:500'],
        ];
    }

    public function messages(): array
    {
        return [
            'department_id.exists' => 'Pick an active department of this company.',
            'fiscal_year.between' => 'Budgets can be set for last year, this year or next year.',
            'total_budget.min' => 'The budget must be at least ₱1.00.',
            'total_budget.decimal' => 'Use at most 2 decimals (centavos).',
            'total_budget.numeric' => 'Type an amount like 1,500,000.00.',
            'alert_threshold_pct.min' => 'The alert must be between 50% and 100%.',
            'alert_threshold_pct.max' => 'The alert must be between 50% and 100%.',
            'reason.required' => 'Say why the budget changes (it’s kept in the history).',
            'reason.min' => 'Say a little more about why (at least 5 characters).',
        ];
    }
}
