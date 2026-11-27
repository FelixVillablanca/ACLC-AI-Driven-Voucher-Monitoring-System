<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Financial reports (Framer ARxG8Aa6F list, UmSNc_71u report, ZoAX4DKjk generate), approved by the user 2026-11-27.
 *  - title; figures = the report's numbers FROZEN when it was made (JSON), so an old report never changes;
 *    includes = what was asked for (AI summary, breakdowns, flagged list, forecast)
 *  - summary_*: the OpenAI summary's state (queued → writing → ready | failed | paused at the spend cap |
 *    not_set_up without an API key | off when not asked for), highlights (JSON chips), model, tokens, cost in
 *    US dollars (for the Super Admin's monthly cap), the last error, tries, when it was written
 *  - is_scheduled: made automatically on the 1st of the month; generated_at
 *  - notifications.type also allows 'report_ready'. MODIFY only widens the list.
 */
return new class extends Migration
{
    private const OLD_TYPES = "'voucher_approved','voucher_rejected','voucher_pending','anomaly_flagged','budget_alert',"
        ."'security_alert','access_changed','user_changed','department_alert','company_changed','system_alert','draft_expiry',"
        ."'support_request','voucher_returned','budget_change'";

    public function up(): void
    {
        Schema::table('financial_reports', function (Blueprint $t) {
            $t->string('title', 160)->nullable()->after('report_type');
            $t->json('figures')->nullable()->after('anomalies_flag')->comment('The numbers when the report was made (never recalculated)');
            $t->json('includes')->nullable()->after('figures');
            $t->enum('summary_status', ['queued', 'writing', 'ready', 'failed', 'paused', 'not_set_up', 'off'])->default('off')->after('ai_summary');
            $t->json('summary_highlights')->nullable()->after('summary_status');
            $t->string('summary_model', 60)->nullable()->after('summary_highlights');
            $t->unsignedInteger('summary_tokens')->nullable()->after('summary_model');
            $t->decimal('summary_cost_usd', 10, 6)->nullable()->after('summary_tokens');
            $t->string('summary_error', 500)->nullable()->after('summary_cost_usd');
            $t->unsignedTinyInteger('summary_attempts')->default(0)->after('summary_error');
            $t->timestamp('summary_generated_at')->nullable()->after('summary_attempts');
            $t->boolean('is_scheduled')->default(false)->after('generated_by');
            $t->timestamp('generated_at')->nullable()->after('is_scheduled');
            $t->index(['company_id', 'period_start'], 'financial_reports_company_period_index');
            $t->index('summary_generated_at', 'financial_reports_summary_generated_index');
        });

        DB::statement('ALTER TABLE `notifications` MODIFY `type` ENUM('.self::OLD_TYPES.",'report_ready') NOT NULL");
    }

    public function down(): void
    {
        DB::table('notifications')->where('type', 'report_ready')->delete();
        DB::statement('ALTER TABLE `notifications` MODIFY `type` ENUM('.self::OLD_TYPES.') NOT NULL');

        Schema::table('financial_reports', function (Blueprint $t) {
            $t->dropIndex('financial_reports_company_period_index');
            $t->dropIndex('financial_reports_summary_generated_index');
            $t->dropColumn(['title', 'figures', 'includes', 'summary_status', 'summary_highlights', 'summary_model', 'summary_tokens',
                'summary_cost_usd', 'summary_error', 'summary_attempts', 'summary_generated_at', 'is_scheduled', 'generated_at']);
        });
    }
};
