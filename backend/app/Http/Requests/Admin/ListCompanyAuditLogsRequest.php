<?php

namespace App\Http\Requests\Admin;

use App\Domain\Audit\AuditCatalog;
use Illuminate\Foundation\Http\FormRequest;

/**
 * GET /api/v1/admin/audit-logs  (System → Audit logs, the Admin's own company only)
 *   ?search=maria        person, email, IP, "#212"
 *   ?group=users          one action group (security | users | settings | system)
 *   ?from=2026-11-01&to=2026-11-22   whole days, Manila time (no dates = the last 7 days)
 *   ?sensitive=1   ?page=2
 * The company and the hidden voucher activity are set by the server (filters()), never by the browser.
 */
class ListCompanyAuditLogsRequest extends FormRequest
{
    public const GROUPS = ['security', 'users', 'settings', 'system'];

    public const DEFAULT_DAYS = 7;

    public function authorize(): bool
    {
        return true; // role:admin middleware
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'search' => ['sometimes', 'nullable', 'string', 'max:120'],
            'group' => ['sometimes', 'nullable', 'in:'.implode(',', self::GROUPS)],
            'from' => ['sometimes', 'nullable', 'date_format:Y-m-d'],
            'to' => array_values(array_filter([
                'sometimes', 'nullable', 'date_format:Y-m-d',
                $this->filled('from') ? 'after_or_equal:from' : null,
                'before_or_equal:'.now()->toDateString(),
            ])),
            'sensitive' => ['sometimes', 'boolean'],
            'page' => ['sometimes', 'integer', 'min:1'],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'to.after_or_equal' => 'The end date must be on or after the start date.',
            'to.before_or_equal' => 'The end date can’t be in the future.',
        ];
    }

    /** The filters for AuditLogSearch, always locked to the Admin's company and without voucher activity. */
    public function filters(): array
    {
        $from = $this->validated('from');
        $to = $this->validated('to');
        $group = $this->validated('group');

        return [
            'search' => $this->validated('search'),
            'actions' => $group ? AuditCatalog::actionsIn($group) ?: [''] : [],
            'from' => $from ?? ($to ? null : now()->subDays(self::DEFAULT_DAYS - 1)->toDateString()),
            'to' => $to,
            'sensitive' => $this->boolean('sensitive'),
            'company_only' => (int) ($this->user()?->company_id ?? -1) ?: -1,
            'hide_groups' => ['vouchers'],
        ];
    }
}
