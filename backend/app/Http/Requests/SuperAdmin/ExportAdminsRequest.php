<?php

namespace App\Http\Requests\SuperAdmin;

use App\Domain\Identity\Support\AdminExport;
use Illuminate\Foundation\Http\FormRequest;

/**
 * "Export admin list" (A1): GET /api/v1/superadmin/admins/export
 *   ?format=csv|pdf
 *   ?accounts=all|view|selected  (+ filter[view] / search for "view", ids[] for "selected")
 *   ?columns[]=name&columns[]=role_status…  (see AdminExport::COLUMNS)
 */
class ExportAdminsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'format' => ['required', 'in:csv,pdf'],
            'accounts' => ['required', 'in:all,view,selected'],
            'filter' => ['sometimes', 'array'],
            'filter.view' => ['sometimes', 'in:'.implode(',', ListAdminsRequest::VIEWS)],
            'search' => ['sometimes', 'nullable', 'string', 'max:100'],
            'ids' => ['required_if:accounts,selected', 'array', 'max:500'],
            'ids.*' => ['integer'],
            'columns' => ['required', 'array', 'min:1'],
            'columns.*' => ['in:'.implode(',', array_keys(AdminExport::COLUMNS))],
        ];
    }

    public function messages(): array
    {
        return ['columns.required' => 'Tick at least one thing to include.', 'columns.min' => 'Tick at least one thing to include.'];
    }
}
