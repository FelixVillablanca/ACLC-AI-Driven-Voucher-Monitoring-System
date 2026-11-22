<?php

namespace App\Http\Requests\SuperAdmin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * POST /api/v1/superadmin/companies  ("+ Add company" on the Companies tab, code-first 2026-11-22)
 *   { name, type, address?, contact_email?, contact_phone?, tin_number?, fiscal_year_start? }
 * Only the Super Admin creates companies (since 2026-11-20); each one then gets its Admin
 * through "Add admin". Names must be unique (letter case ignored), so the Company select in
 * Add admin never shows two look-alike entries.
 */
class StoreCompanyRequest extends FormRequest
{
    /** companies.type (an enum column in the database). */
    public const TYPES = ['corporate', 'school', 'government', 'ngo', 'other'];

    public function authorize(): bool
    {
        return true; // role:super_admin middleware
    }

    protected function prepareForValidation(): void
    {
        $tidy = fn ($value) => is_string($value) ? (trim(preg_replace('/\s+/u', ' ', $value)) ?: null) : $value;

        $this->merge([
            'name' => $tidy($this->input('name')),
            'address' => is_string($this->input('address')) ? (trim($this->input('address')) ?: null) : $this->input('address'),
            'contact_email' => is_string($this->input('contact_email')) ? (mb_strtolower(trim($this->input('contact_email'))) ?: null) : $this->input('contact_email'),
            'contact_phone' => $tidy($this->input('contact_phone')),
            'tin_number' => $tidy($this->input('tin_number')),
            'fiscal_year_start' => $this->input('fiscal_year_start') ?: null,
        ]);
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            // the column's collation (utf8mb4_unicode_ci) ignores letter case, so "APEX" = "Apex"
            'name' => ['required', 'string', 'min:2', 'max:150', Rule::unique('companies', 'name')],
            'type' => ['required', Rule::in(self::TYPES)],
            'address' => ['nullable', 'string', 'max:500'],
            'contact_email' => ['nullable', 'email:rfc', 'max:255'],
            'contact_phone' => ['nullable', 'string', 'max:20', 'regex:/^[0-9+()\-\s]+$/'],
            'tin_number' => ['nullable', 'string', 'max:50', 'regex:/^[0-9\-\s]+$/'],
            'fiscal_year_start' => ['nullable', 'date_format:Y-m-d'],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'name.required' => 'Enter the company name.',
            'name.unique' => 'A company with this name already exists.',
            'type.required' => 'Choose what kind of organisation it is.',
            'type.in' => 'Choose one of the listed types.',
            'contact_email.email' => 'Enter a valid email address.',
            'contact_phone.regex' => 'Use numbers, spaces, +, - and brackets only.',
            'tin_number.regex' => 'Use numbers and dashes only (e.g. 123-456-789-000).',
            'fiscal_year_start.date_format' => 'Choose a valid date.',
        ];
    }
}
