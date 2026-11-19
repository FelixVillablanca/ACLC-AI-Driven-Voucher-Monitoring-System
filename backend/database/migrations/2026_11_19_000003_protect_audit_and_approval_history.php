<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * History must never disappear. Approved by the user on 2026-11-19.
 *
 * 1. audit_logs.company_id and audit_logs.user_id become optional (NULL):
 *    - company_id NULL = a platform-level action (e.g. Super Admin changes a global setting)
 *    - user_id NULL    = done by the system itself (scheduler, "platform defaults applied")
 * 2. Deleting a user or company that has history is now REFUSED (ON DELETE RESTRICT)
 *    instead of silently deleting their audit rows / approval rows (it was CASCADE).
 *    The app deactivates users and suspends companies; it never deletes them.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement('ALTER TABLE `audit_logs`
            DROP FOREIGN KEY `audit_logs_user_id_foreign`,
            DROP FOREIGN KEY `audit_logs_company_id_foreign`');

        DB::statement("ALTER TABLE `audit_logs`
            MODIFY `user_id` BIGINT(20) UNSIGNED NULL DEFAULT NULL COMMENT 'NULL = done by the system',
            MODIFY `company_id` BIGINT(20) UNSIGNED NULL DEFAULT NULL COMMENT 'NULL = platform-level action (no company)'");

        DB::statement('ALTER TABLE `audit_logs`
            ADD CONSTRAINT `audit_logs_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT,
            ADD CONSTRAINT `audit_logs_company_id_foreign` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE RESTRICT');

        DB::statement('ALTER TABLE `voucher_approvals` DROP FOREIGN KEY `voucher_approvals_approver_id_foreign`');
        DB::statement('ALTER TABLE `voucher_approvals`
            ADD CONSTRAINT `voucher_approvals_approver_id_foreign` FOREIGN KEY (`approver_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT');
    }

    public function down(): void
    {
        // Audit rows are append-only: we never delete them to make a rollback fit.
        if (DB::table('audit_logs')->whereNull('user_id')->orWhereNull('company_id')->exists()) {
            throw new RuntimeException('Cannot roll back: audit_logs has platform-level or system rows (NULL user_id/company_id).');
        }

        DB::statement('ALTER TABLE `voucher_approvals` DROP FOREIGN KEY `voucher_approvals_approver_id_foreign`');
        DB::statement('ALTER TABLE `voucher_approvals`
            ADD CONSTRAINT `voucher_approvals_approver_id_foreign` FOREIGN KEY (`approver_id`) REFERENCES `users` (`id`) ON DELETE CASCADE');

        DB::statement('ALTER TABLE `audit_logs`
            DROP FOREIGN KEY `audit_logs_user_id_foreign`,
            DROP FOREIGN KEY `audit_logs_company_id_foreign`');

        DB::statement('ALTER TABLE `audit_logs`
            MODIFY `user_id` BIGINT(20) UNSIGNED NOT NULL,
            MODIFY `company_id` BIGINT(20) UNSIGNED NOT NULL');

        DB::statement('ALTER TABLE `audit_logs`
            ADD CONSTRAINT `audit_logs_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
            ADD CONSTRAINT `audit_logs_company_id_foreign` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE');
    }
};
