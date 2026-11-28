<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

/**
 * POST /api/v1/admin/departments/{department}/people  { user_ids: [..], head_user_id?: id, replace_head?: bool }
 * Add people as members; optionally make one of them (or one already in it) the head. Who is eligible, moving people
 * from another department and the one-head rule are checked in ManageDepartmentPeople.
 */
class AddDepartmentPeopleRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // role:admin + admin.company middleware
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'user_ids' => ['present', 'array', 'max:50'],
            'user_ids.*' => ['integer', 'distinct'],
            'head_user_id' => ['nullable', 'integer'],
            'replace_head' => ['sometimes', 'boolean'],
        ];
    }

    public function after(): array
    {
        return [function ($validator) {
            if (count((array) $this->input('user_ids', [])) === 0 && ! $this->input('head_user_id')) {
                $validator->errors()->add('user_ids', 'Choose at least one person.');
            }
        }];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return ['user_ids.max' => 'Add at most 50 people at a time.'];
    }
}
