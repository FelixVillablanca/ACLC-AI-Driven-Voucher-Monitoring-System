<?php

namespace App\Console\Commands;

use App\Domain\AI\Forecasting\GenerateForecasts;
use App\Models\Company;
use Illuminate\Console\Command;
use Throwable;

/**
 * php artisan forecasts:generate [--company=ID]
 * Works out this month's spending forecasts for every active company (or one). Scheduled on the 1st of
 * every month (routes/console.php). One company failing doesn't stop the others.
 */
class GenerateForecastsCommand extends Command
{
    protected $signature = 'forecasts:generate {--company= : Only this company id}';

    protected $description = 'Work out the monthly spending forecasts (linear trend) for each company';

    public function handle(GenerateForecasts $generate): int
    {
        $companies = Company::query()->where('is_active', true)
            ->when($this->option('company'), fn ($q, $id) => $q->whereKey($id))->get();
        $failed = 0;
        foreach ($companies as $company) {
            try {
                $this->line("{$company->name}: ".$generate->forCompany($company).' forecast rows');
            } catch (Throwable $e) {
                $failed++;
                report($e);
                $this->error("{$company->name}: failed ({$e->getMessage()})");
            }
        }

        return $failed ? self::FAILURE : self::SUCCESS;
    }
}
