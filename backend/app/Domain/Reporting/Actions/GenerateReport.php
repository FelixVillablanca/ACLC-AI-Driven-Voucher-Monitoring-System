<?php

namespace App\Domain\Reporting\Actions;

use App\Domain\Approvals\Support\ApprovalRoute;
use App\Domain\Audit\AuditTrail;
use App\Domain\Reporting\Support\ReportFigures;
use App\Domain\Reporting\Support\ReportPeriod;
use App\Exceptions\ApiException;
use App\Jobs\WriteReportSummary;
use App\Models\Company;
use App\Models\Department;
use App\Models\FinancialReport;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Making a financial report (Framer ZoAX4DKjk "Generate financial report", 2026-11-27).
 * ONE transaction: the numbers are worked out (ReportFigures) and frozen in the row with an audit row; the AI
 * summary is written afterwards by the queued job WriteReportSummary (dispatched after the commit), so the
 * report is there at once and the summary fills in ("Writing…").
 *   generate()        the officer's report (monthly / quarterly / custom, all or one department, what to include)
 *   monthlyFor()      the automatic one on the 1st (last month, all departments, everything; once per month)
 *   rewriteSummary()  "Regenerate" / "Retry": 409 SUMMARY_IN_PROGRESS while one is being written
 */
class GenerateReport
{
    public const DEFAULT_INCLUDES = ['summary' => true, 'breakdown' => true, 'flagged' => true, 'forecast' => false];

    public function __construct(private ReportFigures $figures) {}

    /** @param array{summary?: bool, breakdown?: bool, flagged?: bool, forecast?: bool} $includes */
    public function generate(Company $company, ?User $by, ReportPeriod $period, ?int $departmentId, array $includes, bool $scheduled = false, ?string $ip = null): FinancialReport
    {
        $includes = array_merge(array_map(fn () => false, self::DEFAULT_INCLUDES), array_map('boolval', $includes));
        $department = $departmentId ? Department::query()->where('company_id', $company->id)->findOrFail($departmentId) : null;

        $report = DB::transaction(function () use ($company, $by, $period, $department, $includes, $scheduled, $ip) {
            $f = $this->figures->build($company, $department?->id, $period, $includes);
            $report = FinancialReport::create([
                'company_id' => $company->id,
                'department_id' => $department?->id,
                'report_type' => $period->type,
                'title' => $period->title($department?->name),
                'period_start' => $period->start->toDateString(),
                'period_end' => $period->end->toDateString(),
                'total_vouchers' => $f['approved'],
                'total_amount' => $f['total_spend'],
                'approved_count' => $f['approved'],
                'rejected_count' => $f['rejected'],
                'anomalies_flag' => $f['flagged'],
                'figures' => $f,
                'includes' => $includes,
                'summary_status' => $includes['summary'] ? 'queued' : 'off',
                'generated_by' => $by?->id,
                'is_scheduled' => $scheduled,
                'generated_at' => now(),
                'signoff_status' => FinancialReport::needsSignoff($department?->id, $period->type) ? 'pending' : 'not_needed',
            ]);
            AuditTrail::record([
                'user_id' => $by?->id, 'company_id' => $company->id, 'action' => 'report_generated',
                'table_name' => 'financial_reports', 'record_id' => $report->id,
                'new_values' => ['title' => $report->title, 'type' => $period->type, 'scheduled' => $scheduled, 'includes' => $includes],
                'ip_address' => $ip,
            ]);

            return $report;
        });

        if ($report->signoff_status === 'pending') {
            DB::afterCommit(fn () => self::askForSignoff($report, $company));
        }
        if ($report->summary_status === 'queued') {
            WriteReportSummary::dispatch($report->id)->afterCommit();
        } elseif ($scheduled) {
            self::notify($report, ready: true);
        }

        return $report;
    }

    /** The automatic report on the 1st: last month, all departments. Null when it already exists. */
    public function monthlyFor(Company $company): ?FinancialReport
    {
        $period = ReportPeriod::make('monthly', now()->subMonthNoOverflow()->format('Y-m'));
        $exists = FinancialReport::query()->where('company_id', $company->id)->where('is_scheduled', true)
            ->whereNull('department_id')->where('report_type', 'monthly')->whereDate('period_start', $period->start)->exists();

        return $exists ? null : $this->generate($company, null, $period, null, self::DEFAULT_INCLUDES + ['forecast' => true], scheduled: true);
    }

    public function rewriteSummary(int $reportId, Company $company, User $by, ?string $ip): FinancialReport
    {
        $report = DB::transaction(function () use ($reportId, $company, $by, $ip) {
            /** @var FinancialReport $report */
            $report = FinancialReport::query()->where('company_id', $company->id)->whereKey($reportId)->lockForUpdate()->firstOrFail();
            if (in_array($report->summary_status, ['queued', 'writing'], true)) {
                throw new ApiException('The summary is already being written. It appears here by itself when it’s done.', 'SUMMARY_IN_PROGRESS', 409);
            }
            $report->forceFill([
                'summary_status' => 'queued', 'summary_error' => null, 'summary_attempts' => 0,
                'includes' => array_merge((array) $report->includes, ['summary' => true]),
            ])->save();
            AuditTrail::record([
                'user_id' => $by->id, 'company_id' => $company->id, 'action' => 'report_summary_requested',
                'table_name' => 'financial_reports', 'record_id' => $report->id, 'ip_address' => $ip,
            ]);

            return $report;
        });
        WriteReportSummary::dispatch($report->id)->afterCommit();

        return $report;
    }

    /** Bell notice to the company's Supervisors: a company-wide monthly / quarterly report waits for their sign-off. */
    public static function askForSignoff(FinancialReport $report, Company $company): void
    {
        foreach (ApprovalRoute::supervisorsOf($company) as $supervisor) {
            Notification::create([
                'recipient_id' => $supervisor->id,
                'type' => 'report_signoff',
                'title' => "Report to sign off: {$report->title}",
                'message' => ($report->is_scheduled ? 'The automatic monthly report' : 'A report from Accounting')
                    ." for {$company->name} is waiting for your sign-off.",
            ]);
        }
    }

    /** Bell notice: to whoever made the report, or every Accounting Officer of the company for an automatic one. */
    public static function notify(FinancialReport $report, bool $ready): void
    {
        $recipients = $report->generated_by
            ? [$report->generated_by]
            : User::query()->where('role', 'accounting_officer')->where('is_active', true)
                ->whereHas('accessibleCompanies', fn ($q) => $q->where('companies.id', $report->company_id)->where('user_company_access.granted_status', 'accepted'))
                ->pluck('id')->all();
        $summary = match ($report->summary_status) {
            'ready' => 'with its AI summary',
            'not_set_up' => '(AI summaries aren’t set up yet)',
            'paused' => '(AI summary paused at the monthly spend cap)',
            default => '',
        };
        foreach ($recipients as $id) {
            Notification::create([
                'recipient_id' => $id,
                'type' => 'report_ready',
                'title' => $ready ? "Report ready: {$report->title}" : "Report summary failed: {$report->title}",
                'message' => $ready
                    ? trim(($report->is_scheduled ? 'The automatic monthly report is ready ' : 'Your report is ready ').$summary).'.'
                    : 'The figures are fine; only the AI summary couldn’t be written. Open the report to try again.',
            ]);
        }
    }
}
