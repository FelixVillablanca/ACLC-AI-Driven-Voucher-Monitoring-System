<?php

namespace App\Http\Requests\Reports;

use App\Domain\Reporting\Support\ReportPeriod;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * POST /api/v1/officer/reports (and GET …/preview): the Generate financial report dialog (Framer ZoAX4DKjk).
 *   type        monthly (period "2026-10") | quarterly (period "2026-Q3") | custom (from + to, one department, ≤ 1 year)
 *   department_id  optional (required for custom): a department of the company in X-Company-ID
 *   includes    summary, breakdown, flagged, forecast (true/false)
 * The period can't start in the future.
 */
class GenerateReportRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // role:accounting_officer + company middleware
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        $company = $this->attributes->get('company');

        return [
            'type' => ['required', 'in:monthly,quarterly,custom'],
            'period' => ['required_unless:type,custom', 'nullable', 'string', 'max:10'],
            'from' => ['required_if:type,custom', 'nullable', 'date_format:Y-m-d'],
            'to' => ['required_if:type,custom', 'nullable', 'date_format:Y-m-d', 'after_or_equal:from'],
            'department_id' => ['required_if:type,custom', 'nullable', 'integer', Rule::exists('departments', 'id')->where('company_id', $company->id)],
            'includes' => ['nullable', 'array'],
            'includes.summary' => ['boolean'],
            'includes.breakdown' => ['boolean'],
            'includes.flagged' => ['boolean'],
            'includes.forecast' => ['boolean'],
        ];
    }

    public function after(): array
    {
        return [function (Validator $v) {
            if ($v->errors()->isNotEmpty()) {
                return;
            }
            try {
                $period = $this->period();
            } catch (\Throwable) {
                $v->errors()->add($this->input('type') === 'custom' ? 'from' : 'period', 'Pick a valid period.');

                return;
            }
            if ($period->start->isFuture()) {
                $v->errors()->add($this->input('type') === 'custom' ? 'from' : 'period', 'The period hasn’t started yet.');
            }
            if ($period->type === 'custom' && $period->start->diffInDays($period->end) > 366) {
                $v->errors()->add('to', 'A department report can cover at most one year.');
            }
        }];
    }

    public function messages(): array
    {
        return [
            'department_id.required_if' => 'Pick the department this report is for.',
            'department_id.exists' => 'Pick a department of this company.',
            'from.required_if' => 'Pick the first day.',
            'to.required_if' => 'Pick the last day.',
            'to.after_or_equal' => 'The last day must be on or after the first day.',
            'period.required_unless' => 'Pick the period.',
        ];
    }

    public function period(): ReportPeriod
    {
        $to = $this->input('to');
        if ($to && Carbon::parse($to)->isAfter(Carbon::today())) {
            $to = Carbon::today()->toDateString(); // a report can't include days that haven't happened
        }

        return ReportPeriod::make((string) $this->input('type'), $this->input('period'), $this->input('from'), $to);
    }

    /** @return array{summary: bool, breakdown: bool, flagged: bool, forecast: bool} */
    public function includes(): array
    {
        $in = (array) $this->input('includes', []);

        return [
            'summary' => (bool) ($in['summary'] ?? true),
            'breakdown' => (bool) ($in['breakdown'] ?? true),
            'flagged' => (bool) ($in['flagged'] ?? true),
            'forecast' => (bool) ($in['forecast'] ?? false),
        ];
    }
}
