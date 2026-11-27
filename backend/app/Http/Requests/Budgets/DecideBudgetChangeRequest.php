<?php

namespace App\Http\Requests\Budgets;

use Illuminate\Foundation\Http\FormRequest;

/**
 * POST /api/v1/supervisor/budgets/requests/{id}/approve   approved_budget? (the new total; default = what was asked), note?
 * POST /api/v1/supervisor/budgets/requests/{id}/decline   note (required: Accounting needs to know why)
 * Money: up to 2 decimals, sent as text ("2500000.00"); the range check against the request is in DecideBudgetChange.
 */
class DecideBudgetChangeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // role:supervisor_manager + company middleware
    }

    protected function prepareForValidation(): void
    {
        $clean = [];
        if (is_string($this->approved_budget)) {
            $clean['approved_budget'] = str_replace([',', '₱', ' '], '', $this->approved_budget) ?: null;
        }
        if (is_string($this->note)) {
            $clean['note'] = trim($this->note) ?: null;
        }
        $this->merge($clean);
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        if ($this->routeIs('*.decline')) {
            return ['note' => ['required', 'string', 'min:3', 'max:500']];
        }

        return [
            'approved_budget' => ['sometimes', 'nullable', 'numeric', 'min:1', 'max:9999999999999.99', 'decimal:0,2'],
            'note' => ['sometimes', 'nullable', 'string', 'max:500'],
        ];
    }

    public function messages(): array
    {
        return [
            'note.required' => 'Tell Accounting why you are declining this change.',
            'note.min' => 'Write a little more so Accounting knows why.',
            'approved_budget.decimal' => 'Use at most 2 decimals (centavos).',
        ];
    }
}
