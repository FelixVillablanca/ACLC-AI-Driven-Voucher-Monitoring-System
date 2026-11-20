<?php

namespace App\Http\Requests\SuperAdmin;

use Illuminate\Foundation\Http\FormRequest;

/**
 * GET /api/v1/superadmin/security-alerts?filter[status]=open|closed&cursor=…
 *   open   = the "Not reviewed" tab
 *   closed = the "Reviewed" tab (reviewed or dismissed)
 *   none   = "All"
 */
class ListSecurityAlertsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // the role:super_admin middleware already decided
    }

    public function rules(): array
    {
        return [
            'filter' => ['sometimes', 'array'],
            'filter.status' => ['sometimes', 'in:open,closed'],
            'cursor' => ['sometimes', 'string', 'max:500'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:50'],
        ];
    }
}
