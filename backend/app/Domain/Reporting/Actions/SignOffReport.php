<?php

namespace App\Domain\Reporting\Actions;

use App\Domain\Audit\AuditTrail;
use App\Domain\Vouchers\VoucherStatus as S;
use App\Exceptions\ApiException;
use App\Models\Company;
use App\Models\FinancialReport;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * The Supervisor's sign-off of a financial report (Framer dcfDyyuKE "Manager sign-off"), 2026-11-27. Only reports with
 * signoff_status = pending (company-wide monthly / quarterly). ONE transaction each, row locked, audit + bell notice.
 *   checks()    the checklist: totals_match (worked out NOW: the frozen total vs the approved vouchers of the period
 *               today), summary_reviewed (needed when the AI summary is ready), flags_noted (needed when flags were
 *               still open)
 *   signOff()   ticks + optional comment for the board → signed
 *   sendBack()  a note is required → returned (Accounting is told; they generate a new report)
 * 409 REPORT_NOT_WAITING when it isn't waiting (decided already, or doesn't need sign-off); 422 for missing ticks.
 */
class SignOffReport
{
    /** @return array{totals_match: bool, totals_now: array{total: string, approved: int}, needs_summary_review: bool, needs_flags_noted: bool} */
    public function checks(FinancialReport $r): array
    {
        $now = DB::table('vouchers')->where('company_id', $r->company_id)
            ->when($r->department_id, fn ($q) => $q->where('department_id', $r->department_id))
            ->where('status', S::Approved->value)
            ->whereBetween('approved_at', [$r->period_start->copy()->startOfDay(), $r->period_end->copy()->endOfDay()])
            ->selectRaw('COUNT(*) as n, COALESCE(SUM(amount), 0) as t')->first();
        $frozen = (array) ($r->figures ?? []);

        return [
            'totals_match' => bccomp((string) $now->t, (string) ($frozen['total_spend'] ?? $r->total_amount), 2) === 0
                && (int) $now->n === (int) ($frozen['approved'] ?? $r->approved_count),
            'totals_now' => ['total' => number_format((float) $now->t, 2, '.', ''), 'approved' => (int) $now->n],
            'needs_summary_review' => $r->summary_status === 'ready',
            'needs_flags_noted' => (int) ($frozen['flagged_open'] ?? 0) > 0,
        ];
    }

    /** @param array{summary_reviewed?: bool, flags_noted?: bool} $ticks */
    public function signOff(int $reportId, array $ticks, ?string $comment, User $supervisor, Company $company, ?string $ip): FinancialReport
    {
        return DB::transaction(function () use ($reportId, $ticks, $comment, $supervisor, $company, $ip) {
            $r = $this->lock($reportId, $company);
            $checks = $this->checks($r);
            $errors = [];
            if ($checks['needs_summary_review'] && empty($ticks['summary_reviewed'])) {
                $errors['checks.summary_reviewed'] = ['Read the AI summary and tick “AI summary reviewed” first.'];
            }
            if ($checks['needs_flags_noted'] && empty($ticks['flags_noted'])) {
                $errors['checks.flags_noted'] = ['Tick “Open flags noted for the board”: some flagged vouchers were still open.'];
            }
            if ($errors) {
                throw ValidationException::withMessages($errors);
            }

            $saved = ['totals_match' => $checks['totals_match'], 'summary_reviewed' => (bool) ($ticks['summary_reviewed'] ?? false),
                'flags_noted' => (bool) ($ticks['flags_noted'] ?? false)];
            $r->forceFill(['signoff_status' => 'signed', 'signed_by' => $supervisor->id, 'signed_at' => now(),
                'signoff_comment' => $comment ?: null, 'signoff_checks' => $saved, 'returned_note' => null])->save();
            AuditTrail::record([
                'user_id' => $supervisor->id, 'company_id' => $company->id, 'action' => 'report_signed_off',
                'table_name' => 'financial_reports', 'record_id' => $r->id,
                'old_values' => ['signoff_status' => 'pending'],
                'new_values' => ['signoff_status' => 'signed', 'title' => $r->title, 'checks' => $saved, 'comment' => $comment ?: null],
                'ip_address' => $ip,
            ]);
            $this->notify($r, "Report signed off: {$r->title}",
                "{$supervisor->full_name} signed off the report.".($comment ? ' “'.mb_strimwidth($comment, 0, 160, '…').'”' : ''));

            return $r;
        });
    }

    public function sendBack(int $reportId, string $note, User $supervisor, Company $company, ?string $ip): FinancialReport
    {
        return DB::transaction(function () use ($reportId, $note, $supervisor, $company, $ip) {
            $r = $this->lock($reportId, $company);
            $r->forceFill(['signoff_status' => 'returned', 'signed_by' => $supervisor->id, 'signed_at' => now(), 'returned_note' => $note])->save();
            AuditTrail::record([
                'user_id' => $supervisor->id, 'company_id' => $company->id, 'action' => 'report_returned',
                'table_name' => 'financial_reports', 'record_id' => $r->id,
                'old_values' => ['signoff_status' => 'pending'],
                'new_values' => ['signoff_status' => 'returned', 'title' => $r->title, 'reason' => $note],
                'ip_address' => $ip,
            ]);
            $this->notify($r, "Report sent back: {$r->title}",
                "{$supervisor->full_name} sent the report back: “".mb_strimwidth($note, 0, 200, '…').'” Generate a new one when it’s fixed.');

            return $r;
        });
    }

    private function lock(int $reportId, Company $company): FinancialReport
    {
        /** @var FinancialReport $r */
        $r = FinancialReport::query()->where('company_id', $company->id)->whereKey($reportId)->lockForUpdate()->firstOrFail();
        if ($r->signoff_status !== 'pending') {
            throw new ApiException(match ($r->signoff_status) {
                'signed' => 'This report was already signed off.',
                'returned' => 'This report was already sent back to Accounting.',
                default => 'This report doesn’t need a sign-off (only company-wide monthly and quarterly reports do).',
            }, 'REPORT_NOT_WAITING', 409);
        }

        return $r;
    }

    /** Whoever made the report, or every Accounting Officer of the company for an automatic one. */
    private function notify(FinancialReport $r, string $title, string $message): void
    {
        $recipients = $r->generated_by
            ? [$r->generated_by]
            : User::query()->where('role', 'accounting_officer')->where('is_active', true)
                ->whereHas('accessibleCompanies', fn ($q) => $q->where('companies.id', $r->company_id)->where('user_company_access.granted_status', 'accepted'))
                ->pluck('id')->all();
        foreach ($recipients as $id) {
            Notification::create(['recipient_id' => $id, 'type' => 'report_signoff', 'title' => $title, 'message' => $message]);
        }
    }
}
