<?php

namespace App\Http\Requests\Approvals;

use App\Domain\Approvals\Queries\ReviewQueue;
use Illuminate\Foundation\Http\FormRequest;

/**
 * GET /api/v1/officer/queue
 *   ?filter[view]=ai_flagged|high_value|near_sla|resubmitted  ?filter[department]={id}|none
 *   ?filter[amount_min]=&filter[amount_max]=  ?search=  ?sort=oldest|newest|amount_desc|amount_asc  ?page=
 */
class ListReviewQueueRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // role:accounting_officer + company middleware
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
            'filter.view' => ['sometimes', 'nullable', 'in:'.implode(',', ReviewQueue::VIEWS)],
            'filter.department' => ['sometimes', 'nullable', 'regex:/^(none|[1-9][0-9]{0,18})$/'],
            'filter.amount_min' => ['sometimes', 'nullable', 'numeric', 'min:0', 'decimal:0,2'],
            'filter.amount_max' => ['sometimes', 'nullable', 'numeric', 'min:0', 'decimal:0,2', 'gte:filter.amount_min'],
            'search' => ['sometimes', 'nullable', 'string', 'max:100'],
            'sort' => ['sometimes', 'in:'.implode(',', ReviewQueue::SORTS)],
            'page' => ['sometimes', 'integer', 'min:1'],
        ];
    }

    /** The filters as ReviewQueue reads them. */
    public function filters(): array
    {
        return [
            'view' => $this->validated('filter.view'),
            'department' => $this->validated('filter.department'),
            'amount_min' => $this->validated('filter.amount_min'),
            'amount_max' => $this->validated('filter.amount_max'),
            'search' => $this->validated('search'),
            'sort' => $this->validated('sort'),
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return ['filter.amount_max.gte' => 'The maximum must be at least the minimum.'];
    }
}
