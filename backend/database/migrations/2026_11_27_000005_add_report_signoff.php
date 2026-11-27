<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * The Supervisor's sign-off of financial reports (Framer AaD8UZ08p list, dcfDyyuKE sign-off), approved by the user
 * 2026-11-27. Only company-wide MONTHLY and QUARTERLY reports need it (user decision); the others are "not_needed".
 *  - signoff_status   not_needed | pending (waiting for a Supervisor) | signed | returned (sent back to Accounting)
 *  - signed_by / signed_at   who decided and when (sign-off or send back)
 *  - signoff_comment  "Comments for the board" (optional, on sign-off)
 *  - signoff_checks   the checklist ticks when it was signed (JSON: totals_match, summary_reviewed, flags_noted)
 *  - returned_note    why it was sent back (required then)
 *  - notifications.type also allows 'report_signoff'. MODIFY only widens the list.
 * Existing company-wide monthly / quarterly reports become "pending".
 */
return new class extends Migration
{
    private const OLD_TYPES = "'voucher_approved','voucher_rejected','voucher_pending','anomaly_flagged','budget_alert',"
        ."'security_alert','access_changed','user_changed','department_alert','company_changed','system_alert','draft_expiry',"
        ."'support_request','voucher_returned','budget_change','report_ready'";

    public function up(): void
    {
        Schema::table('financial_reports', function (Blueprint $t) {
            $t->enum('signoff_status', ['not_needed', 'pending', 'signed', 'returned'])->default('not_needed')->after('generated_at')
                ->comment('Supervisor sign-off: company-wide monthly / quarterly reports only');
            $t->foreignId('signed_by')->nullable()->after('signoff_status')->constrained('users')->nullOnDelete();
            $t->timestamp('signed_at')->nullable()->after('signed_by');
            $t->string('signoff_comment', 1000)->nullable()->after('signed_at')->comment('Comments for the board');
            $t->json('signoff_checks')->nullable()->after('signoff_comment');
            $t->string('returned_note', 1000)->nullable()->after('signoff_checks')->comment('Why it was sent back to Accounting');
            $t->index(['company_id', 'signoff_status'], 'financial_reports_company_signoff_index');
        });

        DB::table('financial_reports')->whereNull('department_id')->whereIn('report_type', ['monthly', 'quarterly'])
            ->update(['signoff_status' => 'pending']);

        DB::statement('ALTER TABLE `notifications` MODIFY `type` ENUM('.self::OLD_TYPES.",'report_signoff') NOT NULL");
    }

    public function down(): void
    {
        DB::table('notifications')->where('type', 'report_signoff')->delete();
        DB::statement('ALTER TABLE `notifications` MODIFY `type` ENUM('.self::OLD_TYPES.') NOT NULL');

        Schema::table('financial_reports', function (Blueprint $t) {
            $t->dropIndex('financial_reports_company_signoff_index');
            $t->dropConstrainedForeignId('signed_by');
            $t->dropColumn(['signoff_status', 'signed_at', 'signoff_comment', 'signoff_checks', 'returned_note']);
        });
    }
};
