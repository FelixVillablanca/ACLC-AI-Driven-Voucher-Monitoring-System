<?php

namespace App\Http\Requests\SuperAdmin;

/**
 * "Export audit log" (AL1): GET /api/v1/superadmin/audit-logs/export
 *   ?from=…&to=…             the dialog's date range (Today / Last 7 days / Last 30 days / Custom)
 *   ?events=all|sensitive|filters   "filters" = also apply the page's search / company / action filters
 *   ?include[]=values&include[]=request   before/after values, request ID + browser
 *   + the same filter parameters as the list (used when events=filters)
 */
class ExportAuditLogsRequest extends ListAuditLogsRequest
{
    /** A bigger file than this is too slow to build in one go: ask for a shorter range instead. */
    public const MAX_ROWS = 50000;

    public function rules(): array
    {
        return [
            ...parent::rules(),
            'from' => ['required', 'date_format:Y-m-d'],
            'events' => ['required', 'in:all,sensitive,filters'],
            'include' => ['sometimes', 'array'],
            'include.*' => ['in:values,request'],
        ];
    }

    public function filters(): array
    {
        $page = parent::filters();
        $range = ['from' => $this->validated('from'), 'to' => $this->validated('to')];

        return match ($this->validated('events')) {
            'sensitive' => ['sensitive' => true, ...$range],
            'filters' => [...$page, ...$range],
            default => $range,
        };
    }
}
