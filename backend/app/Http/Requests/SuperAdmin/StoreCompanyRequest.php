<?php

namespace App\Http\Requests\SuperAdmin;

use App\Domain\Identity\Queries\UnassignedAdmins;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * POST /api/v1/superadmin/companies  ("+ Add company" on the Companies tab, code-first 2026-11-22)
 *   { name, type, address?, latitude?, longitude?, place_id?, contact_email?, contact_phone?, tin_number?, fiscal_year_start?, admin_id? }
 * admin_id (optional, 2026-11-28): an Admin with no company yet, who then runs this new company.
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
            // a place ID only means something together with a pin
            'place_id' => blank($this->input('latitude')) ? null
                : (is_string($this->input('place_id')) ? (trim($this->input('place_id')) ?: null) : $this->input('place_id')),
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
            // the map pin: both numbers or neither
            'latitude' => ['nullable', 'required_with:longitude', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'required_with:latitude', 'numeric', 'between:-180,180'],
            'place_id' => ['nullable', 'string', 'max:255', 'regex:/^(node|way|relation)\/[0-9]+$/'],  // OpenStreetMap place, e.g. way/123456; none for a pin placed by hand
            'contact_email' => ['nullable', 'email:rfc', 'max:255'],
            'contact_phone' => ['nullable', 'string', 'max:20', 'regex:/^[0-9+()\-\s]+$/'],
            'tin_number' => ['nullable', 'string', 'max:50', 'regex:/^[0-9\-\s]+$/'],
            'fiscal_year_start' => ['nullable', 'date_format:Y-m-d'],
            'admin_id' => ['nullable', 'integer', UnassignedAdmins::rule()],
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
            'latitude.required_with' => 'Place the pin on the map again.',
            'longitude.required_with' => 'Place the pin on the map again.',
            'latitude.between' => 'This map location isn’t valid. Place the pin again.',
            'longitude.between' => 'This map location isn’t valid. Place the pin again.',
            'place_id.regex' => 'Pick the place again on the map.',
            'contact_email.email' => 'Enter a valid email address.',
            'contact_phone.regex' => 'Use numbers, spaces, +, - and brackets only.',
            'tin_number.regex' => 'Use numbers and dashes only (e.g. 123-456-789-000).',
            'fiscal_year_start.date_format' => 'Choose a valid date.',
        ];
    }
}
