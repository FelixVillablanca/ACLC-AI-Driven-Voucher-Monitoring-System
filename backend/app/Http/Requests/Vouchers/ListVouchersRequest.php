<?php

namespace App\Http\Requests\Vouchers;

use App\Domain\Vouchers\Queries\ClerkVouchers;
use Illuminate\Foundation\Http\FormRequest;

/**
 * GET /api/v1/vouchers  (My vouchers)
 *   ?filter[view]=draft|in_review|returned|approved|rejected|cancelled   ?search=pldt | APX-2026 | 18,450
 *   ?sort=recent|oldest|amount_desc|amount_asc   ?page=2
 */
class ListVouchersRequest extends FormRequest
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
            'filter.view' => ['sometimes', 'nullable', 'in:'.implode(',', ClerkVouchers::VIEWS)],
            'search' => ['sometimes', 'nullable', 'string', 'max:100'],
            'sort' => ['sometimes', 'in:'.implode(',', ClerkVouchers::SORTS)],
            'page' => ['sometimes', 'integer', 'min:1'],
        ];
    }
}
