<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Two-step sign-in (Admins tab frames U7glXUOSF, A11 x8wWbSPsg, A12 QgC8ADhk4), approved by the user 2026-11-21.
 *
 *   two_factor_secret          the authenticator-app key, ENCRYPTED with APP_KEY (never shown again after setup)
 *   two_factor_recovery_codes  8 one-time backup codes (hashed), for a lost phone
 *   two_factor_confirmed_at    set once they typed a correct code: two-step is ON
 *   two_factor_required_at     a Super Admin required it (they must set it up at their next sign-in)
 *   two_factor_setup_deadline  until then they may "set up later"; after it, sign-in waits for setup
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->text('two_factor_secret')->nullable()->after('password');
            $table->text('two_factor_recovery_codes')->nullable()->after('two_factor_secret');
            $table->timestamp('two_factor_confirmed_at')->nullable()->after('two_factor_recovery_codes');
            $table->timestamp('two_factor_required_at')->nullable()->after('two_factor_confirmed_at');
            $table->timestamp('two_factor_setup_deadline')->nullable()->after('two_factor_required_at');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'two_factor_secret', 'two_factor_recovery_codes', 'two_factor_confirmed_at',
                'two_factor_required_at', 'two_factor_setup_deadline',
            ]);
        });
    }
};
