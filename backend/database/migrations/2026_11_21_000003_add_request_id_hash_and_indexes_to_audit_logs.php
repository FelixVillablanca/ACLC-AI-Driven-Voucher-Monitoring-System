<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Audit logs tab (Framer EJ0asP2ZH + AL1–AL9), approved by the user 2026-11-21.
 *
 * 1. request_id  the id every API request gets (AssignRequestId, "req_…"), so the entries one
 *                click produced can be grouped ("Same request" in AL7).
 * 2. hash        a FINGERPRINT of the entry (HMAC-SHA256 with the app key) written with it.
 *                If anyone edits the row later straight in the database, the fingerprint no longer
 *                matches ("Untouched since it was written" in AL7). Older rows have NULL.
 * 3. Indexes so search and filters stay fast as the log grows: time, action, IP, table+record.
 *
 * Only ADDS nullable columns and indexes: existing rows are untouched.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('audit_logs', function (Blueprint $table) {
            $table->string('request_id', 64)->nullable()->after('user_agent')->comment('AssignRequestId: groups the entries of one request');
            $table->char('hash', 64)->nullable()->after('request_id')->comment('HMAC-SHA256 fingerprint; NULL = written before fingerprints');

            $table->index('created_at');
            $table->index(['action', 'created_at']);
            $table->index('ip_address');
            $table->index(['table_name', 'record_id']);
            $table->index('request_id');
        });
    }

    public function down(): void
    {
        Schema::table('audit_logs', function (Blueprint $table) {
            $table->dropIndex(['created_at']);
            $table->dropIndex(['action', 'created_at']);
            $table->dropIndex(['ip_address']);
            $table->dropIndex(['table_name', 'record_id']);
            $table->dropIndex(['request_id']);
            $table->dropColumn(['request_id', 'hash']);
        });
    }
};
