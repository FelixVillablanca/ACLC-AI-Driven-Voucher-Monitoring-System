<?php

namespace App\Console\Commands;

use App\Domain\Reporting\Actions\GenerateReport;
use App\Models\Company;
use Illuminate\Console\Command;
use Throwable;

/**
 * php artisan reports:monthly [--company=ID]
 * The automatic report on the 1st (user decision 2026-11-27): last month, all departments, for every active
 * company; made once per month (a second run skips companies that already have it). The officers get a bell
 * notice when it's ready (with its AI summary if OpenAI is set up).
 */
class MonthlyReportsCommand extends Command
{
    protected $signature = 'reports:monthly {--company= : Only this company id}';

    protected $description = 'Make last month\'s financial report for every company';

    public function handle(GenerateReport $generate): int
    {
        $failed = 0;
        $companies = Company::query()->where('is_active', true)->when($this->option('company'), fn ($q, $id) => $q->whereKey($id))->get();
        foreach ($companies as $company) {
            try {
                $report = $generate->monthlyFor($company);
                $this->line($company->name.': '.($report ? "made report #{$report->id}" : 'already made'));
            } catch (Throwable $e) {
                $failed++;
                report($e);
                $this->error("{$company->name}: failed ({$e->getMessage()})");
            }
        }

        return $failed ? self::FAILURE : self::SUCCESS;
    }
}
