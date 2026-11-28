<?php

namespace App\Http\Requests\SuperAdmin;

use App\Domain\Tenancy\Queries\CompaniesWithoutAdmin;
use Closure;
use Illuminate\Foundation\Http\FormRequest;

/**
 * POST /api/v1/superadmin/admins/{user}/company  { company_id }
 * Admins tab "Assign to a company" (2026-11-28): an Admin with no company yet becomes the Admin of a company that has none.
 */
class AssignAdminCompanyRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // role:super_admin middleware; who can be assigned is AccountActions 'assign_company'
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'company_id' => ['required', 'integer', function (string $attribute, mixed $value, Closure $fail) {
                if (! CompaniesWithoutAdmin::query()->whereKey($value)->exists()) {
                    $fail('This company already has an Admin or isn’t active. Pick another one.');
                }
            }],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return ['company_id.required' => 'Choose the company they will run.'];
    }
}
