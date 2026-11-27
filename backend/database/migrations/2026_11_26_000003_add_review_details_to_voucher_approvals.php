<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Accounting Officer review (Framer vZeEe5_Hq … Ssn7fclsz), approved by the user 2026-11-26.
 *  - voucher_approvals.needs_changes: what a Return asks the clerk to fix, e.g. ["attachments","line_items"]
 *  - voucher_approvals.reason: why a voucher was rejected, e.g. "duplicate"
 *  - notifications.type also allows 'voucher_returned' (the clerk's bell). MODIFY only widens the list.
 */
return new class extends Migration
{
    private const OLD_TYPES = "'voucher_approved','voucher_rejected','voucher_pending','anomaly_flagged','budget_alert',"
        ."'security_alert','access_changed','user_changed','department_alert','company_changed','system_alert','draft_expiry','support_request'";

    public function up(): void
    {
        Schema::table('voucher_approvals', function (Blueprint $t) {
            $t->json('needs_changes')->nullable()->after('remarks')->comment('Return: the parts the clerk must fix');
            $t->string('reason', 60)->nullable()->after('needs_changes')->comment('Reject: the reason picked by the reviewer');
        });

        DB::statement('ALTER TABLE `notifications` MODIFY `type` ENUM('.self::OLD_TYPES.",'voucher_returned') NOT NULL");
    }

    public function down(): void
    {
        DB::table('notifications')->where('type', 'voucher_returned')->delete();
        DB::statement('ALTER TABLE `notifications` MODIFY `type` ENUM('.self::OLD_TYPES.') NOT NULL');

        Schema::table('voucher_approvals', function (Blueprint $t) {
            $t->dropColumn(['needs_changes', 'reason']);
        });
    }
};
