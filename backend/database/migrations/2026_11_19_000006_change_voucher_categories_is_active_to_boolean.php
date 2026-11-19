<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * voucher_categories.is_active was ENUM('activated','notActivated'); every other table uses 0/1.
 * Converted to TINYINT(1): 'activated' -> 1, 'notActivated' -> 0. New categories default to active (1),
 * like companies and departments. Approved by the user on 2026-11-19.
 *
 * Steps: add a temporary 0/1 column, copy the values over, drop the old column, rename the new one.
 * (CHANGE is used for the rename because MariaDB 10.4 has no RENAME COLUMN.)
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement('ALTER TABLE `voucher_categories` ADD `is_active_tmp` TINYINT(1) NOT NULL DEFAULT 1 AFTER `is_active`');
        DB::statement("UPDATE `voucher_categories` SET `is_active_tmp` = IF(`is_active` = 'activated', 1, 0)");
        DB::statement('ALTER TABLE `voucher_categories` DROP COLUMN `is_active`');
        DB::statement('ALTER TABLE `voucher_categories` CHANGE `is_active_tmp` `is_active` TINYINT(1) NOT NULL DEFAULT 1');
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE `voucher_categories` ADD `is_active_tmp` ENUM('activated','notActivated') NOT NULL DEFAULT 'notActivated' AFTER `is_active`");
        DB::statement("UPDATE `voucher_categories` SET `is_active_tmp` = IF(`is_active` = 1, 'activated', 'notActivated')");
        DB::statement('ALTER TABLE `voucher_categories` DROP COLUMN `is_active`');
        DB::statement("ALTER TABLE `voucher_categories` CHANGE `is_active_tmp` `is_active` ENUM('activated','notActivated') NOT NULL DEFAULT 'notActivated'");
    }
};
