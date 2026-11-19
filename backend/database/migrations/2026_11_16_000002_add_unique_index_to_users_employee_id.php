<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Employee IDs are now auto-generated (EMP-2026-0001, …). A UNIQUE index makes
 * the DATABASE itself refuse a duplicate, even if two admins click "Create user"
 * at the very same moment. Approved by the user on 2026-11-16.
 * (Empty / NULL employee IDs are still allowed; UNIQUE ignores NULLs.)
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->unique('employee_id', 'users_employee_id_unique');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique('users_employee_id_unique');
        });
    }
};
