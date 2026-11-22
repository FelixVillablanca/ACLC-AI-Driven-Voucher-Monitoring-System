<?php

namespace App\Http\Requests\Admin;

use App\Domain\Tenancy\Queries\CompanyDirectory;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * POST /api/v1/admin/departments  (Quick actions → "Add department", code-first 2026-11-22)
 *   { name, code, description?, head_user_id? }
 * The department always goes into the Admin's own company (never sent from the browser).
 * Name and code must be unique inside that company (letter case ignored); other companies may reuse them.
 */
class StoreDepartmentRequest extends FormRequest
{
    public const OPERATIONAL_ROLES = ['accounting_clerk', 'accounting_officer', 'supervisor_manager'];

    public function authorize(): bool
    {
        return true; // role:admin middleware
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'name' => is_string($this->name) ? trim(preg_replace('/\s+/u', ' ', $this->name)) : $this->name,
            'code' => is_string($this->code) ? strtoupper(trim($this->code)) : $this->code,
            'description' => is_string($this->description) ? (trim($this->description) ?: null) : $this->description,
            'head_user_id' => $this->head_user_id ?: null,
        ]);
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        $companyId = (int) $this->user()?->company_id;

        return [
            'name' => ['required', 'string', 'min:2', 'max:150', Rule::unique('departments', 'name')->where('company_id', $companyId)],
            'code' => ['required', 'string', 'max:20', 'regex:/^[A-Z0-9]+(-[A-Z0-9]+)*$/', Rule::unique('departments', 'code')->where('company_id', $companyId)],
            'description' => ['nullable', 'string', 'max:500'],
            'head_user_id' => ['nullable', 'integer'],
        ];
    }

    /** The head must be an active clerk / officer / supervisor of the Admin's company. */
    public function after(): array
    {
        return [
            function (Validator $validator) {
                $headId = $this->input('head_user_id');
                if (! $headId || $validator->errors()->has('head_user_id')) {
                    return;
                }
                $ok = CompanyDirectory::usersOf((int) $this->user()?->company_id)
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

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'name.required' => 'Enter the department name.',
            'name.unique' => 'Your company already has a department with this name.',
            'code.required' => 'Enter a short code, e.g. FIN.',
            'code.regex' => 'Use capital letters and numbers, with - between parts (e.g. FIN or HR-OPS).',
            'code.unique' => 'Your company already uses this code.',
            'code.max' => 'The code can be at most 20 characters.',
        ];
    }
}
