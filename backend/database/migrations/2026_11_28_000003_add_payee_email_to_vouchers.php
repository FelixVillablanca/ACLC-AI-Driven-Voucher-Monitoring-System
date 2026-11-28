<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The payee's email on a voucher (user decision 2026-11-28): optional; filled from the saved payee when there is one.
 * After the Supervisor's final approval the clerk can "Email the payee" with the payment PDF attached.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('vouchers', function (Blueprint $t) {
            $t->string('payee_email', 255)->nullable()->after('payee_name')->comment('Where "Email the payee" sends the approval + payment PDF');
        });
    }

    public function down(): void
    {
        Schema::table('vouchers', function (Blueprint $t) {
            $t->dropColumn('payee_email');
        });
    }
};
