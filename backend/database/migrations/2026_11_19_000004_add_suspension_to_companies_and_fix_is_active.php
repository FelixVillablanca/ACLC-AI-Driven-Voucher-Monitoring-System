<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Approved by the user on 2026-11-19.
 *
 * 1. Companies can be suspended by a Super Admin with a required reason
 *    (Framer eGUijf8Wd "Suspend confirm"): suspended_at, suspended_by, suspension_reason.
 *    A suspended company has is_active = 0 AND suspended_at set.
 * 2. companies.is_active and departments.is_active can no longer be NULL ("unknown").
 *    Existing NULLs keep the meaning the code already gives them:
 *      - companies:   NULL was counted as INACTIVE (AdminDashboardSummary) -> 0
 *      - departments: NULL was listed as ACTIVE   (LookupController)       -> 1
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::table('companies')->whereNull('is_active')->update(['is_active' => 0]);
        DB::table('departments')->whereNull('is_active')->update(['is_active' => 1]);

        DB::statement("ALTER TABLE `companies`
            MODIFY `is_active` TINYINT(1) NOT NULL DEFAULT 1,
            ADD `suspended_at` TIMESTAMP NULL DEFAULT NULL COMMENT 'Set when a Super Admin suspends the company' AFTER `is_active`,
            ADD `suspended_by` BIGINT(20) UNSIGNED NULL DEFAULT NULL AFTER `suspended_at`,
            ADD `suspension_reason` TEXT NULL DEFAULT NULL COMMENT 'Required when suspending' AFTER `suspended_by`,
            ADD KEY `companies_suspended_by_foreign` (`suspended_by`),
            ADD CONSTRAINT `companies_suspended_by_foreign` FOREIGN KEY (`suspended_by`) REFERENCES `users` (`id`) ON DELETE SET NULL");

        DB::statement('ALTER TABLE `departments` MODIFY `is_active` TINYINT(1) NOT NULL DEFAULT 1');
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE `companies`
            DROP FOREIGN KEY `companies_suspended_by_foreign`,
            DROP KEY `companies_suspended_by_foreign`,
            DROP COLUMN `suspension_reason`,
            DROP COLUMN `suspended_by`,
            DROP COLUMN `suspended_at`,
            MODIFY `is_active` TINYINT(4) NULL DEFAULT NULL');

        DB::statement('ALTER TABLE `departments` MODIFY `is_active` TINYINT(4) NULL DEFAULT NULL');
    }
};
