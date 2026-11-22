<?php

namespace App\Http\Requests\Admin;

use App\Domain\Tenancy\Queries\CompanyDirectory;
use App\Models\Department;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * PATCH /api/v1/admin/departments/{department}
 *   { name, code, description?, head_user_id?, updated_at }
 * Same rules as "Add department", except the department's own name/code don't count as taken,
 * and its CURRENT head may stay even if that person was deactivated since.
 * `updated_at` = when the form was opened (the action refuses with 409 if it changed since).
 */
class UpdateDepartmentRequest extends StoreDepartmentRequest
{
    /** @return array<string, mixed> */
    public function rules(): array
    {
        $companyId = (int) $this->user()?->company_id;
        $id = (int) $this->route('department');

        return [
            'name' => ['required', 'string', 'min:2', 'max:150', Rule::unique('departments', 'name')->where('company_id', $companyId)->ignore($id)],
            'code' => ['required', 'string', 'max:20', 'regex:/^[A-Z0-9]+(-[A-Z0-9]+)*$/', Rule::unique('departments', 'code')->where('company_id', $companyId)->ignore($id)],
            'description' => ['nullable', 'string', 'max:500'],
            'head_user_id' => ['nullable', 'integer'],
            'updated_at' => ['nullable', 'string', 'max:40'],
        ];
    }

    public function after(): array
    {
        return [
            function (Validator $validator) {
                $headId = (int) $this->input('head_user_id');
                if (! $headId || $validator->errors()->has('head_user_id')) {
                    return;
                }
                $companyId = (int) $this->user()?->company_id;
                $currentHead = (int) Department::where('company_id', $companyId)->whereKey((int) $this->route('department'))->value('head_user_id');
                if ($headId === $currentHead) {
                    return; // keeping the head as it is
                }
                $ok = CompanyDirectory::usersOf($companyId)
                    ->whereKey($headId)
                    ->whereIn('role', self::OPERATIONAL_ROLES)
                    ->where('is_active', true)
                    ->exists();
                if (! $ok) {
                    $validator->errors()->add('head_user_id', 'Choose an active person from your company.');
                }
            },
        ];
    }
}
