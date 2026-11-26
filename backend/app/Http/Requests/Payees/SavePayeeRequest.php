<?php

namespace App\Http\Requests\Payees;

use App\Http\Requests\Vouchers\SaveVoucherRequest;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * POST /api/v1/payees (Add payee, Framer UKm7GrwEZ) and PATCH /api/v1/payees/{id} (edit).
 * Name and type are required (the frame's *). The TIN is optional (payees made from vouchers that
 * existed before Payees have none) but, when given, must be 9 or 12 digits; it's stored as 000-000-000-000.
 * The type must be one of this company's payee types. Same name / TIN twice: SavePayee answers 422.
 */
class SavePayeeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // role:accounting_clerk + company middleware
    }

    protected function prepareForValidation(): void
    {
        $trim = fn ($v) => is_string($v) ? (trim($v) === '' ? null : preg_replace('/\s+/', ' ', trim($v))) : $v;
        $this->merge(collect(['name', 'tin', 'bank_name', 'bank_account_number', 'bank_account_name', 'address', 'email'])
            ->mapWithKeys(fn ($f) => [$f => $trim($this->input($f))])->all());
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        $companyId = (int) $this->attributes->get('company')?->id;

        return [
            'name' => ['required', 'string', 'max:255'],
            'payee_type_id' => ['required', 'integer', Rule::exists('payee_types', 'id')->where('company_id', $companyId)],
            'tin' => ['nullable', 'string', 'max:20', function ($attr, $value, $fail) {
                $digits = preg_replace('/\D/', '', (string) $value);
                if (! in_array(strlen($digits), [9, 12], true) || preg_match('/[^0-9\- ]/', (string) $value)) {
                    $fail('Enter the TIN as 9 or 12 digits, e.g. 000-101-528-000.');
                }
            }],
            'default_payment_method' => ['nullable', Rule::in(SaveVoucherRequest::PAYMENT_METHODS)],
            'bank_name' => ['nullable', 'string', 'max:150'],
            'bank_account_number' => ['nullable', 'string', 'max:50', 'regex:/^[0-9 \-]+$/'],
            'bank_account_name' => ['nullable', 'string', 'max:150'],
            'address' => ['nullable', 'string', 'max:500'],
            'email' => ['nullable', 'email:rfc', 'max:255'],
            'updated_at' => ['nullable', 'string', 'max:40'],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'name.required' => 'Enter the payee’s name.',
            'payee_type_id.required' => 'Choose a payee type.',
            'payee_type_id.exists' => 'Choose a payee type of this company.',
            'bank_account_number.regex' => 'Use numbers, spaces and dashes only.',
            'email.email' => 'Enter a valid email address, e.g. billing@company.ph.',
        ];
    }
}
