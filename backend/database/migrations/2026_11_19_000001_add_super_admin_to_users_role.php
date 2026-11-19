<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Super Admin role (docs/System_Flow_Roles_and_UML_Design.docx §4).
 * Adds 'super_admin' to the users.role list. Approved by the user on 2026-11-19.
 *
 * MODIFY on an ENUM only widens the allowed list, so existing rows are untouched.
 */
return new class extends Migration
{
    private const OLD_ROLES = "'admin','accounting_clerk','accounting_officer','supervisor_manager'";

    public function up(): void
    {
        DB::statement("ALTER TABLE `users` MODIFY `role` ENUM('super_admin',".self::OLD_ROLES.') NOT NULL');
    }

    public function down(): void
    {
        // A Super Admin row can't fit the old list. We refuse rather than delete or demote people silently.
        if (DB::table('users')->where('role', 'super_admin')->exists()) {
            throw new RuntimeException('Cannot roll back: change or remove the super_admin users first.');
        }

        DB::statement('ALTER TABLE `users` MODIFY `role` ENUM('.self::OLD_ROLES.') NOT NULL');
    }
};
