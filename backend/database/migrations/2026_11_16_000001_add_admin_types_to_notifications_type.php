<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Adds ADMIN notification types (approved by the user on 2026-11-16) so the
 * admin bell panel (Framer D7aTKQEDz) can store Security / Access / Users /
 * Departments / Companies notifications. The 5 voucher types stay exactly as before.
 *
 * MODIFY on an ENUM only widens the allowed list here, so existing rows are untouched.
 */
return new class extends Migration
{
    private const VOUCHER_TYPES = "'voucher_approved','voucher_rejected','voucher_pending','anomaly_flagged','budget_alert'";

    private const ADMIN_TYPES = "'security_alert','access_changed','user_changed','department_alert','company_changed'";

    public function up(): void
    {
        DB::statement('ALTER TABLE `notifications` MODIFY `type` ENUM('.self::VOUCHER_TYPES.','.self::ADMIN_TYPES.') NOT NULL');
    }

    public function down(): void
    {
        // Rows using an admin type can't fit the old list, so they are removed first.
        DB::table('notifications')
            ->whereIn('type', ['security_alert', 'access_changed', 'user_changed', 'department_alert', 'company_changed'])
            ->delete();

        DB::statement('ALTER TABLE `notifications` MODIFY `type` ENUM('.self::VOUCHER_TYPES.') NOT NULL');
    }
};
