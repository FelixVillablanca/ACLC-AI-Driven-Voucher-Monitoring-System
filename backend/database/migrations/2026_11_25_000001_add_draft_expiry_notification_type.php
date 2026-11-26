<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Drafts page (Framer Xfr2PEq2q), approved by the user 2026-11-25: drafts untouched for 30 days are deleted
 * by a nightly job, and the clerk gets a bell notice 3 days before (and one when it happens).
 * notifications.type also allows 'draft_expiry'. MODIFY on an ENUM only widens the list, so existing rows
 * are untouched.
 */
return new class extends Migration
{
    private const OLD_TYPES = "'voucher_approved','voucher_rejected','voucher_pending','anomaly_flagged','budget_alert',"
        ."'security_alert','access_changed','user_changed','department_alert','company_changed','system_alert'";

    public function up(): void
    {
        DB::statement('ALTER TABLE `notifications` MODIFY `type` ENUM('.self::OLD_TYPES.",'draft_expiry') NOT NULL");
    }

    public function down(): void
    {
        DB::table('notifications')->where('type', 'draft_expiry')->delete();
        DB::statement('ALTER TABLE `notifications` MODIFY `type` ENUM('.self::OLD_TYPES.') NOT NULL');
    }
};
