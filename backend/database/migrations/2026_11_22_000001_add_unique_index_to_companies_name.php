<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * One name per company (approved by the user 2026-11-22, for "+ Add company").
 *
 * The form already refuses a duplicate name (StoreCompanyRequest), but two clicks at the same
 * moment could both pass that check. A UNIQUE index lets the database itself refuse the second one.
 * The column's collation (utf8mb4_unicode_ci) ignores letter case, so "APEX" and "Apex" count as the same.
 *
 * If the table already has duplicate names, the index can't be added: this migration stops and
 * lists them, so they can be renamed first (nothing is changed automatically).
 */
return new class extends Migration
{
    public function up(): void
    {
        $duplicates = DB::table('companies')
            ->select('name', DB::raw('COUNT(*) as total'), DB::raw('GROUP_CONCAT(id ORDER BY id) as ids'))
            ->groupBy('name')
            ->having('total', '>', 1)
            ->get();

        if ($duplicates->isNotEmpty()) {
            $list = $duplicates->map(fn ($d) => "\"{$d->name}\" (ids {$d->ids})")->implode(', ');

            throw new RuntimeException("Can't add the unique index: these company names are used more than once: {$list}. Rename them, then run the migration again.");
        }

        Schema::table('companies', function (Blueprint $table) {
            $table->unique('name', 'companies_name_unique');
        });
    }

    public function down(): void
    {
        Schema::table('companies', function (Blueprint $table) {
            $table->dropUnique('companies_name_unique');
        });
    }
};
