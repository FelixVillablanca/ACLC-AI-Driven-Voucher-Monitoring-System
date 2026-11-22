<?php

namespace App\Http\Requests\Admin;

use App\Domain\Tenancy\Queries\DepartmentDirectory;
use Illuminate\Foundation\Http\FormRequest;

/**
 * GET /api/v1/admin/departments
 *   ?filter[view]=active|inactive|no_head   (none = All)
 *   ?search=fin                              name, code or the head's name
 *   ?sort=name|name_desc|people|newest
 *   ?page=2&per_page=20
 */
class ListDepartmentsRequest extends FormRequest
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
            'filter.view' => ['sometimes', 'in:'.implode(',', DepartmentDirectory::VIEWS)],
            'search' => ['sometimes', 'nullable', 'string', 'max:100'],
            'sort' => ['sometimes', 'in:'.implode(',', DepartmentDirectory::SORTS)],
            'page' => ['sometimes', 'integer', 'min:1'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
        ];
    }
}
