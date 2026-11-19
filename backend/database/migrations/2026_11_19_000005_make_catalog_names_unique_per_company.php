<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Each company can have its own "Supplier" payee type, "Cash Advance" voucher type, etc.
 * Uniqueness moves from "whole system" to "per company". Approved by the user on 2026-11-19.
 *
 * Note: MariaDB lets several rows with company_id = NULL (shared rows) share a name,
 * so the app's validation must check that case itself.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('voucher_types', function (Blueprint $table) {
            $table->dropUnique('voucher_types_name_unique');
            $table->unique(['company_id', 'name'], 'voucher_types_company_id_name_unique');
        });

        Schema::table('payee_types', function (Blueprint $table) {
            $table->dropUnique('payee_types_name_unique');
            $table->unique(['company_id', 'name'], 'payee_types_company_id_name_unique');
        });

        Schema::table('voucher_categories', function (Blueprint $table) {
            $table->dropUnique('voucher_categories_code_unique');
            $table->unique(['company_id', 'code'], 'voucher_categories_company_id_code_unique');
        });
    }

    // Rolling back fails if two companies already use the same name/code (the DB refuses the old index).
    public function down(): void
    {
        Schema::table('voucher_categories', function (Blueprint $table) {
            $table->dropUnique('voucher_categories_company_id_code_unique');
            $table->unique('code', 'voucher_categories_code_unique');
        });

        Schema::table('payee_types', function (Blueprint $table) {
            $table->dropUnique('payee_types_company_id_name_unique');
            $table->unique('name', 'payee_types_name_unique');
        });

        Schema::table('voucher_types', function (Blueprint $table) {
            $table->dropUnique('voucher_types_company_id_name_unique');
            $table->unique('name', 'voucher_types_name_unique');
        });
    }
};
