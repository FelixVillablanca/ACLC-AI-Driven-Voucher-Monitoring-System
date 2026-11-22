<?php

namespace App\Http\Requests\SuperAdmin;

use App\Domain\Tenancy\Support\CompanyExport;
use Illuminate\Foundation\Http\FormRequest;

/**
 * "Export companies" (C1): GET /api/v1/superadmin/companies/export
 *   ?format=xlsx|csv|pdf
 *   ?companies=all|active|suspended|search   ("search" = the companies matching ?search=)
 *   ?columns[]=details&columns[]=counts&columns[]=suspension   (see CompanyExport::COLUMNS)
 *   ?sort=…&suspended_first=1   the same order as the screen
 */
class ExportCompaniesRequest extends FormRequest
{
    public const WHICH = ['all', 'active', 'suspended', 'search'];

    public function authorize(): bool
    {
        return true; // role:super_admin middleware
    }

    public function rules(): array
    {
        return [
            'format' => ['required', 'in:'.implode(',', CompanyExport::FORMATS)],
            'companies' => ['required', 'in:'.implode(',', self::WHICH)],
            'search' => ['required_if:companies,search', 'nullable', 'string', 'max:100'],
            'columns' => ['required', 'array', 'min:1'],
            'columns.*' => ['in:'.implode(',', array_keys(CompanyExport::COLUMNS))],
            'sort' => ['sometimes', 'in:'.implode(',', ListCompaniesRequest::SORTS)],
            'suspended_first' => ['sometimes', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'columns.required' => 'Tick at least one thing to include.',
            'columns.min' => 'Tick at least one thing to include.',
            'search.required_if' => 'Type a search first, or export all companies.',
        ];
    }
}
