<?php

namespace App\Console\Commands;

use App\Domain\Identity\Actions\ExpireUnassignedAdmins;
use App\Domain\Identity\Queries\UnassignedAdmins;
use Illuminate\Console\Command;

/**
 * php artisan admins:expire-unassigned
 * Admins created with "No company yet": warns the Super Admins 3 h before and removes the account after 24 h.
 * Runs every 5 minutes (routes/console.php); safe to run by hand any time.
 */
class ExpireUnassignedAdminsCommand extends Command
{
    protected $signature = 'admins:expire-unassigned';

    protected $description = 'Remove Admin accounts that got no company within '.UnassignedAdmins::GRACE_HOURS.' hours';

    public function handle(ExpireUnassignedAdmins $expire): int
    {
        $r = $expire->handle();
        $this->info("Warnings sent: {$r['warned']} · Deleted: {$r['deleted']} · Deactivated: {$r['deactivated']}");

        return self::SUCCESS;
    }
}
