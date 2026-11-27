<?php

namespace App\Domain\Approvals\Support;

use App\Domain\Platform\SystemSettings;
use App\Models\Company;
use App\Models\User;
use App\Models\Voucher;
use Illuminate\Support\Carbon;

/**
 * THE ROUTING RULE (Global settings → Approval rules), read live when Accounting approves:
 * a voucher needs the Supervisor / Manager (step 2) when
 *   - its total is at or above the high-value threshold, or
 *   - it is AI-flagged and "Send AI-flagged vouchers to step 2" is on.
 * Otherwise Accounting's approval is final. Also: the review SLA (hours) and its warning level (75%).
 */
final class ApprovalRoute
{
    public const NEAR_SLA_SHARE = 0.75;

    public function __construct(private SystemSettings $settings) {}

    public function threshold(): string
    {
        return (string) $this->settings->value(SystemSettings::HIGH_VALUE_THRESHOLD);
    }

    public function aiFlaggedNeedsStep2(): bool
    {
        return (bool) $this->settings->value(SystemSettings::AI_FLAGGED_NEEDS_STEP_2);
    }

    public function slaHours(): int
    {
        return (int) $this->settings->value(SystemSettings::REVIEW_SLA_HOURS);
    }

    /** Submitted on or before this moment = near (or past) the SLA. */
    public function nearSlaSince(): Carbon
    {
        return now()->subMinutes((int) round($this->slaHours() * 60 * self::NEAR_SLA_SHARE));
    }

    /** @return list<string> why step 2 is needed: 'high_value', 'ai_flagged' (empty = Accounting decides) */
    public function step2Reasons(Voucher $voucher): array
    {
        $reasons = [];
        if (bccomp((string) $voucher->amount, $this->threshold(), 2) >= 0) {
            $reasons[] = 'high_value';
        }
        if ($voucher->ai_anomaly_flag && $this->aiFlaggedNeedsStep2()) {
            $reasons[] = 'ai_flagged';
        }

        return $reasons;
    }

    /** ok | near | over: how long it has waited for Accounting against the SLA. */
    public function slaState(?Carbon $waitingSince): string
    {
        if (! $waitingSince) {
            return 'ok';
        }
        $hours = $waitingSince->diffInMinutes(now()) / 60;

        return $hours >= $this->slaHours() ? 'over' : ($hours >= $this->slaHours() * self::NEAR_SLA_SHARE ? 'near' : 'ok');
    }

    /** The active Supervisors / Managers who work in this company (accepted access). */
    public static function supervisorsOf(Company $company)
    {
        return User::query()->where('role', 'supervisor_manager')->where('is_active', true)
            ->whereHas('accessibleCompanies', fn ($q) => $q->where('companies.id', $company->id)->where('user_company_access.granted_status', 'accepted'))
            ->orderBy('first_name')->get(['id', 'first_name', 'last_name', 'email', 'personal_email']);
    }
}
