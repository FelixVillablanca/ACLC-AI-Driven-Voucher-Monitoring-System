<?php

namespace App\Http\Requests\Vouchers;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * POST /api/v1/vouchers (new draft) and PATCH /api/v1/vouchers/{id} (edit a draft / returned voucher).
 *
 * A DRAFT may be incomplete: only the category and the payment method are needed (the database
 * requires them). Everything a reviewer needs is checked again when the voucher is SUBMITTED
 * (TransitionVoucher::submit), with the same field names, so the form can show the errors.
 *
 * Choices must belong to the company in X-Company-ID (ResolveCompany): categories (or a built-in
 * one), voucher types, payee types and departments of another company are refused.
 * The total is never sent: the server adds up the line items.
 */
class SaveVoucherRequest extends FormRequest
{
    public const PAYMENT_METHODS = ['cash', 'bank', 'cheque'];

    public const PRIORITIES = ['low', 'normal', 'high', 'urgent'];

    public const MAX_LINES = 50;

    public function authorize(): bool
    {
        return true; // role:accounting_clerk + company middleware
    }

    protected function prepareForValidation(): void
    {
        $trim = fn ($v) => is_string($v) ? (trim($v) === '' ? null : trim($v)) : $v;
        $lines = is_array($this->line_items) ? array_values($this->line_items) : $this->line_items;

        $this->merge([
            'payee_name' => $trim($this->payee_name),
            'description' => $trim($this->description),
            'purpose' => $trim($this->purpose),
            'reference_number' => $trim($this->reference_number),
            'bank_name' => $trim($this->bank_name),
            'bank_account_number' => $trim($this->bank_account_number),
            'bank_account_name' => $trim($this->bank_account_name),
            'line_items' => is_array($lines)
                ? array_map(fn ($l) => is_array($l) ? [...$l, 'description' => $trim($l['description'] ?? null), 'unit' => $trim($l['unit'] ?? null)] : $l, $lines)
                : $lines,
        ]);
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        $companyId = (int) $this->attributes->get('company')?->id;
        $own = fn (string $table) => Rule::exists($table, 'id')->where('company_id', $companyId);

        return [
            'category_id' => ['required', 'integer', Rule::exists('voucher_categories', 'id')
                ->where(fn ($q) => $q->where('is_active', true)->where(fn ($w) => $w->where('company_id', $companyId)->orWhereNull('company_id')))],
            'payment_method' => ['required', Rule::in(self::PAYMENT_METHODS)],
            'voucher_type_id' => ['nullable', 'integer', $own('voucher_types')],
            'payee_type_id' => ['nullable', 'integer', $own('payee_types')],
            'department_id' => ['nullable', 'integer', Rule::exists('departments', 'id')->where('company_id', $companyId)->where('is_active', true)],
            'payee_name' => ['nullable', 'string', 'max:255'],
            // a saved payee of this company (2026-11-26); its name replaces payee_name when saving
            'payee_id' => ['nullable', 'integer', Rule::exists('payees', 'id')->where('company_id', $companyId)->where('is_active', true)],
            'description' => ['nullable', 'string', 'max:2000'],
            'purpose' => ['nullable', 'string', 'max:2000'],
            'reference_number' => ['nullable', 'string', 'max:100'],
            'due_date' => ['nullable', 'date_format:Y-m-d'],
            'priority' => ['nullable', Rule::in(self::PRIORITIES)],
            'bank_name' => ['nullable', 'string', 'max:150'],
            'bank_account_number' => ['nullable', 'string', 'max:50', 'regex:/^[0-9 \-]+$/'],
            'bank_account_name' => ['nullable', 'string', 'max:150'],
            'line_items' => ['present', 'array', 'max:'.self::MAX_LINES],
            'line_items.*.description' => ['required', 'string', 'max:255'],
            'line_items.*.quantity' => ['required', 'numeric', 'gt:0', 'max:99999999.99', 'decimal:0,2'],
            'line_items.*.unit' => ['nullable', 'string', 'max:30'],
            'line_items.*.unit_price' => ['required', 'numeric', 'min:0', 'max:999999999999.99', 'decimal:0,2'],
            'updated_at' => ['nullable', 'string', 'max:40'],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'category_id.required' => 'Choose a category.',
            'category_id.exists' => 'Choose an active category of this company.',
            'payment_method.required' => 'Choose how it will be paid.',
            'voucher_type_id.exists' => 'Choose a voucher type of this company.',
            'payee_type_id.exists' => 'Choose a payee type of this company.',
            'payee_id.exists' => 'This payee was deactivated or isn’t in this company. Choose another one.',
            'department_id.exists' => 'Choose an active department of this company.',
            'bank_account_number.regex' => 'Use numbers, spaces and dashes only.',
            'line_items.max' => 'A voucher can have at most 50 lines.',
            'line_items.*.description.required' => 'Describe this line.',
            'line_items.*.quantity.required' => 'Enter the quantity.',
            'line_items.*.quantity.gt' => 'The quantity must be more than 0.',
            'line_items.*.quantity.decimal' => 'Use at most 2 decimals.',
            'line_items.*.unit_price.required' => 'Enter the unit price.',
            'line_items.*.unit_price.min' => 'The price can’t be negative.',
            'line_items.*.unit_price.decimal' => 'Use at most 2 decimals (centavos).',
        ];
    }
}
