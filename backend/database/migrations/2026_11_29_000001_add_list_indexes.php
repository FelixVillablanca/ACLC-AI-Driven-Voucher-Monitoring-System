<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Phase 7, Step 2 (performance), user-approved 2026-11-28: indexes for the lists every tab asks for each minute.
 * No data changes. A COMPOSITE index (several columns) lets the database jump straight to "company 3, status pending,
 * oldest first" instead of reading every voucher of company 3.
 *
 *   vouchers (company_id, status, submitted_at)   review queues, sidebar counts, dashboards
 *   vouchers (created_by, company_id, status)     the clerk's own lists and dashboard
 *   notifications (recipient_id, is_read, created_at)  the bell count and list
 *   audit_logs (company_id, created_at)           Admin / Supervisor audit pages (company + date range)
 *   voucher_approvals (voucher_id, step)          review history and "latest Level 1 approval"
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('vouchers', function (Blueprint $t) {
            $t->index(['company_id', 'status', 'submitted_at'], 'vouchers_company_status_submitted_index');
            $t->index(['created_by', 'company_id', 'status'], 'vouchers_creator_company_status_index');
        });
        Schema::table('notifications', function (Blueprint $t) {
            $t->index(['recipient_id', 'is_read', 'created_at'], 'notifications_recipient_read_created_index');
        });
        Schema::table('audit_logs', function (Blueprint $t) {
            $t->index(['company_id', 'created_at'], 'audit_logs_company_created_index');
        });
        Schema::table('voucher_approvals', function (Blueprint $t) {
            $t->index(['voucher_id', 'step'], 'voucher_approvals_voucher_step_index');
        });
    }

    public function down(): void
    {
        // The foreign keys keep using their own single-column indexes, so these can be dropped safely.
        Schema::table('vouchers', function (Blueprint $t) {
            $t->dropIndex('vouchers_company_status_submitted_index');
            $t->dropIndex('vouchers_creator_company_status_index');
        });
        Schema::table('notifications', function (Blueprint $t) {
            $t->dropIndex('notifications_recipient_read_created_index');
        });
        Schema::table('audit_logs', function (Blueprint $t) {
            $t->dropIndex('audit_logs_company_created_index');
        });
        Schema::table('voucher_approvals', function (Blueprint $t) {
            $t->dropIndex('voucher_approvals_voucher_step_index');
        });
    }
};
