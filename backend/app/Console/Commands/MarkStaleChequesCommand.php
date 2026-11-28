<?php

namespace App\Console\Commands;

use App\Domain\Vouchers\Cheques\ChequeRules;
use App\Domain\Vouchers\Cheques\MarkStaleCheques;
use Illuminate\Console\Command;

/**
 * php artisan cheques:mark-stale
 * Reminds clerks about cheques that go stale within 30 days and marks uncleared cheques stale 180 days after their date.
 * Runs every night at 01:45 (routes/console.php); safe to run by hand any time.
 */
class MarkStaleChequesCommand extends Command
{
    protected $signature = 'cheques:mark-stale';

    protected $description = 'Remind about and mark stale the cheques not cleared within '.ChequeRules::STALE_DAYS.' days';

    public function handle(MarkStaleCheques $job): int
    {
        $result = $job->handle();
        $this->info("Reminders sent: {$result['reminded']} · Cheques marked stale: {$result['marked']}");

        return self::SUCCESS;
    }
}
