<?php

namespace App\Http\Requests\SuperAdmin;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Audit logs tab: GET /api/v1/superadmin/audit-logs
 *   ?search=180.190.77.4        person, email, IP, "#212"
 *   ?companies[]=3&companies[]=platform
 *   ?actions[]=login_failed&actions[]=login
 *   ?from=2026-11-12&to=2026-11-19   whole days, Manila time (defaults: today)
 *   ?sensitive=1
 *   ?page=2
 * The export (AL1) uses the same filters.
 */
class ListAuditLogsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // role:super_admin middleware
    }

    public function rules(): array
    {
        return [
            'search' => ['sometimes', 'nullable', 'string', 'max:120'],
            'companies' => ['sometimes', 'array', 'max:200'],
            'companies.*' => ['string', 'regex:/^(\d+|platform)$/'],
            'actions' => ['sometimes', 'array', 'max:100'],
            'actions.*' => ['string', 'max:60', 'regex:/^[a-z_]+$/'],
            'from' => ['sometimes', 'nullable', 'date_format:Y-m-d'],
            'to' => array_values(array_filter([
                'sometimes', 'nullable', 'date_format:Y-m-d',
                $this->filled('from') ? 'after_or_equal:from' : null, // only compare when there IS a start date
                'before_or_equal:'.now()->toDateString(),
            ])),
            'sensitive' => ['sometimes', 'boolean'],
            'page' => ['sometimes', 'integer', 'min:1'],
        ];
    }

    public function messages(): array
    {
        return [
            'to.after_or_equal' => 'The end date must be on or after the start date.',
            'to.before_or_equal' => 'The end date can’t be in the future.',
        ];
    }

    /** The filters for AuditLogSearch. With no dates, the page shows today (as in the frame). */
    public function filters(): array
    {
        $from = $this->validated('from');
        $to = $this->validated('to');

        return [
            'search' => $this->validated('search'),
            'companies' => $this->validated('companies', []),
            'actions' => $this->validated('actions', []),
            'from' => $from ?? ($to ? null : now()->toDateString()),
            'to' => $to,
            'sensitive' => $this->boolean('sensitive'),
        ];
    }
}
