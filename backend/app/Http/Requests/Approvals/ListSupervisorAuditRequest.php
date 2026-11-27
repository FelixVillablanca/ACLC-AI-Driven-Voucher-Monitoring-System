<?php

namespace App\Http\Requests\Approvals;

use App\Domain\Audit\AuditCatalog;
use App\Domain\Audit\Queries\AuditLogSearch;
use Illuminate\Foundation\Http\FormRequest;

/**
 * GET /api/v1/supervisor/audit[/export]  (the Supervisor's Audit trail, Framer xqItzoFYK, 2026-11-27)
 *   ?range=today|7d|30d|90d   or ?from=2026-11-01&to=2026-11-27 (whole days, Manila time; nothing = the last 7 days)
 *   ?search=APX-2026-0433     a person, IP, "#14", a voucher number (text inside the entry)
 *   ?user={id}  ?action=voucher_approved  ?table=budget_allocations  ?page=2
 * The company and the "vouchers, budgets, reports, forecasts only" scope are set by the server (filters()).
 */
class ListSupervisorAuditRequest extends FormRequest
{
    public const RANGES = ['today' => 1, '7d' => 7, '30d' => 30, '90d' => 90];

    public function authorize(): bool
    {
        return true; // role:supervisor_manager + company middleware
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'range' => ['sometimes', 'nullable', 'in:'.implode(',', array_keys(self::RANGES))],
            'from' => ['sometimes', 'nullable', 'date_format:Y-m-d'],
            'to' => array_values(array_filter([
                'sometimes', 'nullable', 'date_format:Y-m-d',
                $this->filled('from') ? 'after_or_equal:from' : null,
                'before_or_equal:'.now()->toDateString(),
            ])),
            'search' => ['sometimes', 'nullable', 'string', 'max:120'],
            'user' => ['sometimes', 'nullable', 'integer', 'min:1'],
            'action' => ['sometimes', 'nullable', 'string', 'in:'.implode(',', self::actions())],
            'table' => ['sometimes', 'nullable', 'in:'.implode(',', AuditLogSearch::VOUCHER_TABLES)],
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

    /** Every action the Supervisor's trail can show (the vouchers group). */
    public static function actions(): array
    {
        return AuditCatalog::actionsIn('vouchers');
    }

    /** The filters for AuditLogSearch, always locked to the company in X-Company-ID and to finance activity. */
    public function filters(): array
    {
        $from = $this->validated('from');
        $to = $this->validated('to');
        if (! $from && ! $to) {
            $days = self::RANGES[$this->validated('range') ?? '7d'];
            $from = now()->subDays($days - 1)->toDateString();
        }

        return [
            'search' => $this->validated('search'),
            'actions' => ($a = $this->validated('action')) ? [$a] : [],
            'user_id' => $this->validated('user'),
            'tables' => ($t = $this->validated('table')) ? [$t] : [],
            'from' => $from,
            'to' => $to,
            'company_only' => $this->attributes->get('company')->id,
            'finance_only' => true,
        ];
    }

    /** The scope alone (cards, options, one entry): company + finance activity. */
    public function scope(): array
    {
        return ['company_only' => $this->attributes->get('company')->id, 'finance_only' => true];
    }
}
