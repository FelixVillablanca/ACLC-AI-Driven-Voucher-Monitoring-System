<?php

namespace App\Http\Requests\Admin;

use App\Models\Department;
use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * PATCH /api/v1/admin/users/{user}  { first_name, last_name, role, department_id?, updated_at }
 * The department must be an ACTIVE one of the Admin's company, except that the person may stay
 * in the department they're already in even if it was deactivated since.
 */
class UpdateCompanyUserRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // role:admin middleware
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'first_name' => trim((string) $this->input('first_name')),
            'last_name' => trim((string) $this->input('last_name')),
            'department_id' => $this->input('department_id') ?: null,
        ]);
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'first_name' => ['required', 'string', 'max:100'],
            'last_name' => ['required', 'string', 'max:100'],
            'role' => ['required', Rule::in(StoreUserRequest::ROLES)],
            'department_id' => ['nullable', 'integer'],
            'updated_at' => ['nullable', 'string', 'max:40'],
        ];
    }

    public function after(): array
    {
        return [
            function (Validator $validator) {
                $departmentId = (int) $this->input('department_id');
                if (! $departmentId || $validator->errors()->has('department_id')) {
                    return;
                }
                $companyId = (int) $this->user()?->company_id;
                $department = Department::where('company_id', $companyId)->find($departmentId);
                $current = (int) User::where('company_id', $companyId)->whereKey((int) $this->route('user'))->value('department_id');

                if (! $department || (! $department->is_active && $department->id !== $current)) {
                    $validator->errors()->add('department_id', 'Choose an active department of your company.');
                }
            },
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'first_name.required' => 'Enter the first name.',
            'last_name.required' => 'Enter the last name.',
            'role.required' => 'Choose a role.',
            'role.in' => 'Choose Clerk, Officer or Supervisor. Admin accounts are created by a Super Admin.',
        ];
    }
}
