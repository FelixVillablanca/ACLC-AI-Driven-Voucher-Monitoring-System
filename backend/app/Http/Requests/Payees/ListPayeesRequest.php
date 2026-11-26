<?php

namespace App\Http\Requests\Payees;

use App\Domain\Catalog\Payees\PayeeDirectory;
use Illuminate\Foundation\Http\FormRequest;

/**
 * GET /api/v1/payees and /payees/export
 *   ?filter[status]=active|inactive  ?filter[type]={payee type id}|none  ?search=meralco | 000-101 | 3810
 *   ?sort=most_used|name|recent|approved_desc  ?page=2   (export only: ?format=csv|xlsx)
 */
class ListPayeesRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // role:accounting_clerk + company middleware
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
            'filter.status' => ['sometimes', 'nullable', 'in:'.implode(',', PayeeDirectory::STATUSES)],
            'filter.type' => ['sometimes', 'nullable', 'regex:/^(none|[1-9][0-9]{0,18})$/'],
            'search' => ['sometimes', 'nullable', 'string', 'max:100'],
            'sort' => ['sometimes', 'in:'.implode(',', PayeeDirectory::SORTS)],
            'page' => ['sometimes', 'integer', 'min:1'],
            'format' => ['sometimes', 'in:csv,xlsx'],
        ];
    }
}
