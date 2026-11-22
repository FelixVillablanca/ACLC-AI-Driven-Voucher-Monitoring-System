<?php

namespace App\Http\Requests\SuperAdmin;

use Illuminate\Foundation\Http\FormRequest;

/**
 * GET /api/v1/superadmin/companies (Companies tab, Framer vnNFYExpX)
 *   ?filter[view]=active|suspended                     the segmented views (none = All)
 *   ?search=north                                      name or address
 *   ?sort=name|name_desc|users|departments|recent|newest   (C3 sort menu)
 *   ?suspended_first=1                                 the switch at the bottom of the sort menu
 *   ?page=2&per_page=24
 */
class ListCompaniesRequest extends FormRequest
{
    public const VIEWS = ['active', 'suspended'];

    public const SORTS = ['name', 'name_desc', 'users', 'departments', 'recent', 'newest'];

    public function authorize(): bool
    {
        return true; // role:super_admin middleware
    }

    public function rules(): array
    {
        return [
            'filter' => ['sometimes', 'array'],
            'filter.view' => ['sometimes', 'in:'.implode(',', self::VIEWS)],
            'search' => ['sometimes', 'nullable', 'string', 'max:100'],
            'sort' => ['sometimes', 'in:'.implode(',', self::SORTS)],
            'suspended_first' => ['sometimes', 'boolean'],
            'page' => ['sometimes', 'integer', 'min:1'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
        ];
    }
}
