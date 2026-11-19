<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The person's OWN email (Gmail, Yahoo…), separate from their work sign-in email (@Administrator.com…).
 * New Admins get their "set your password" invitation there (decided 2026-11-20), and it can be
 * reused for future password resets. Optional (nullable): existing users don't have one.
 * Not unique: two work accounts may belong to the same person.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('personal_email', 255)->nullable()->after('email');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('personal_email');
        });
    }
};
