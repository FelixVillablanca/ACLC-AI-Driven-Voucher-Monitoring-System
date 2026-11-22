<?php

namespace App\Http\Requests\Admin;

use App\Domain\Identity\Queries\CompanyUserDirectory;
use Illuminate\Foundation\Http\FormRequest;

/**
 * GET /api/v1/admin/users
 *   ?filter[view]=active|pending|inactive   ?filter[role]=accounting_clerk|…   ?filter[department]={id}|none
 *   ?search=maria   ?sort=name|name_desc|newest|last_sign_in   ?page=2&per_page=20
 */
class ListCompanyUsersRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // role:admin middleware
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->search)) {
            $this->merge(['search' => trim($this->search) ?: null]);
        }
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'filter' => ['sometimes', 'array'],
            'filter.view' => ['sometimes', 'in:'.implode(',', CompanyUserDirectory::VIEWS)],
            'filter.role' => ['sometimes', 'in:'.implode(',', CompanyUserDirectory::ROLES)],
            'filter.department' => ['sometimes', 'regex:/^(none|[1-9][0-9]*)$/'],
            'search' => ['sometimes', 'nullable', 'string', 'max:100'],
            'sort' => ['sometimes', 'in:'.implode(',', CompanyUserDirectory::SORTS)],
            'page' => ['sometimes', 'integer', 'min:1'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
        ];
    }
}
