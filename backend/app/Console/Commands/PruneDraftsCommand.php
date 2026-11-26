<?php

namespace App\Console\Commands;

use App\Domain\Vouchers\Actions\PruneExpiredDrafts;
use App\Domain\Vouchers\Support\DraftExpiry;
use Illuminate\Console\Command;

/**
 * php artisan vouchers:prune-drafts
 * Reminds clerks about drafts that expire within 3 days and deletes drafts untouched for 30 days.
 * Runs every night at 01:30 (routes/console.php); safe to run by hand any time.
 */
class PruneDraftsCommand extends Command
{
    protected $signature = 'vouchers:prune-drafts';

    protected $description = 'Remind about and delete drafts with no changes for '.DraftExpiry::DAYS.' days';

    public function handle(PruneExpiredDrafts $prune): int
    {
        $result = $prune->handle();
        $this->info("Reminders sent: {$result['reminded']} · Drafts deleted: {$result['deleted']}");

        return self::SUCCESS;
    }
}
