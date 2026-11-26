<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Help & guides → Contact support (Framer mudjUlcnp), approved by the user 2026-11-26: a clerk's message
 * goes to the Admin of the company they're working in as a bell notice (+ an email).
 * notifications.type also allows 'support_request'. MODIFY on an ENUM only widens the list.
 */
return new class extends Migration
{
    private const OLD_TYPES = "'voucher_approved','voucher_rejected','voucher_pending','anomaly_flagged','budget_alert',"
        ."'security_alert','access_changed','user_changed','department_alert','company_changed','system_alert','draft_expiry'";

    public function up(): void
    {
        DB::statement('ALTER TABLE `notifications` MODIFY `type` ENUM('.self::OLD_TYPES.",'support_request') NOT NULL");
    }

    public function down(): void
    {
        DB::table('notifications')->where('type', 'support_request')->delete();
        DB::statement('ALTER TABLE `notifications` MODIFY `type` ENUM('.self::OLD_TYPES.') NOT NULL');
    }
};
