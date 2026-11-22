<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

/**
 * POST /api/v1/admin/company-access  { user_ids: [12, 15] }
 * Always the Admin's own company (never sent). Whether each person may be granted is checked
 * inside the action, with the rows locked (GrantCompanyAccess).
 */
class GrantCompanyAccessRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // role:admin middleware
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'user_ids' => ['required', 'array', 'min:1', 'max:100'],
            'user_ids.*' => ['integer', 'distinct'],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'user_ids.required' => 'Choose at least one person.',
            'user_ids.min' => 'Choose at least one person.',
            'user_ids.max' => 'Choose at most 100 people at a time.',
        ];
    }
}
