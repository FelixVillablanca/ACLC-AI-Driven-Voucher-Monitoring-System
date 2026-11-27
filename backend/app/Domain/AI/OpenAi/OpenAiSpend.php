<?php

namespace App\Domain\AI\OpenAi;

use App\Domain\Platform\SystemSettings;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * What OpenAI cost this month, platform-wide (2026-11-27): the sum of every report summary written this
 * calendar month (financial_reports.summary_cost_usd). Compared with the Super Admin's Global settings
 * "Monthly spend cap" ($) and "Pause summaries at the cap", which are IN USE since then.
 */
class OpenAiSpend
{
    public function __construct(private SystemSettings $settings) {}

    public function thisMonth(): string
    {
        $spent = DB::table('financial_reports')->where('summary_generated_at', '>=', Carbon::now()->startOfMonth())
            ->sum('summary_cost_usd');

        return number_format((float) $spent, 4, '.', '');
    }

    public function cap(): string
    {
        return (string) $this->settings->value(SystemSettings::OPENAI_MONTHLY_CAP_USD);
    }

    /** True when the cap is reached AND the Super Admin chose to pause summaries there. */
    public function paused(): bool
    {
        return (bool) $this->settings->value(SystemSettings::OPENAI_PAUSE_AT_CAP)
            && (float) $this->thisMonth() >= (float) $this->cap();
    }
}
