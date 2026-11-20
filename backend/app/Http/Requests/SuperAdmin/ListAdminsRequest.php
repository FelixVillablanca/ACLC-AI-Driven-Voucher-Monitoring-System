<?php

namespace App\Http\Requests\SuperAdmin;

use Illuminate\Foundation\Http\FormRequest;

/**
 * GET /api/v1/superadmin/admins (Admins tab, Framer U7glXUOSF)
 *   ?filter[view]=super_admins|admins|pending|inactive   the segmented views (none = All)
 *   ?search=liza                                          name or email
 *   ?sort=last_sign_in|name|role|attention|created  &order=desc|asc   (A4 sort menu)
 *   ?page=2&per_page=25
 */
class ListAdminsRequest extends FormRequest
{
    public const VIEWS = ['super_admins', 'admins', 'pending', 'inactive'];

    public const SORTS = ['last_sign_in', 'name', 'role', 'attention', 'created'];

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
            'order' => ['sometimes', 'in:asc,desc'],
            'page' => ['sometimes', 'integer', 'min:1'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
        ];
    }
}
