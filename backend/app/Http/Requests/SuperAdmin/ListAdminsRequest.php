<?php

namespace App\Http\Requests\SuperAdmin;

use Illuminate\Foundation\Http\FormRequest;

/**
 * GET /api/v1/superadmin/admins (Admin accounts page, Framer bxGFPLOVN)
 *   ?filter[status]=active|pending|inactive   the All / Active / Pending / Inactive chips
 *   ?filter[role]=admin|super_admin           "Role: All ▾"
 *   ?search=liza                              name or email
 *   ?page=2&per_page=25
 */
class ListAdminsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // role:super_admin middleware
    }

    public function rules(): array
    {
        return [
            'filter' => ['sometimes', 'array'],
            'filter.status' => ['sometimes', 'in:active,pending,inactive'],
            'filter.role' => ['sometimes', 'in:admin,super_admin'],
            'search' => ['sometimes', 'nullable', 'string', 'max:100'],
            'page' => ['sometimes', 'integer', 'min:1'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
        ];
    }
}
