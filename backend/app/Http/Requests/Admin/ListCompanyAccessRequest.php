<?php

namespace App\Http\Requests\Admin;

use App\Domain\Tenancy\Queries\CompanyAccessDirectory;
use Illuminate\Foundation\Http\FormRequest;

/**
 * GET /api/v1/admin/company-access
 *   ?filter[view]=has_access|no_access|other_companies   ?search=maria   ?sort=name|name_desc|recent   ?page=2
 */
class ListCompanyAccessRequest extends FormRequest
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
            'filter.view' => ['sometimes', 'in:'.implode(',', CompanyAccessDirectory::VIEWS)],
            'search' => ['sometimes', 'nullable', 'string', 'max:100'],
            'sort' => ['sometimes', 'in:'.implode(',', CompanyAccessDirectory::SORTS)],
            'page' => ['sometimes', 'integer', 'min:1'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
        ];
    }
}
