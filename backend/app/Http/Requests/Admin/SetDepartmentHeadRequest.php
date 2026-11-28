<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

/**
 * POST /api/v1/admin/departments/{department}/head  { user_id, replace_head?: bool }
 * Makes this person the department's ONE head (they join it if they aren't in it yet).
 */
class SetDepartmentHeadRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // role:admin + admin.company middleware
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'user_id' => ['required', 'integer'],
            'replace_head' => ['sometimes', 'boolean'],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return ['user_id.required' => 'Choose who will be the head.'];
    }
}
