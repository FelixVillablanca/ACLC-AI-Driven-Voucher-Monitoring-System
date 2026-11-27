<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Flagged vouchers (Framer dtNDyUAUp list, YX1IiDXMp investigate), approved by the user 2026-11-27.
 * The automatic check (rule-based now, the ML model in Phase 5) keeps using ai_anomaly_flag / score / reason, plus:
 *  - ai_check_signals: what drove the score [{key, value, normal, impact}] (the "What drove the score" table)
 *  - ai_check_source:  'rules' now, 'model' once the ML service runs (so the screens can say which)
 *  - ai_checked_at:    when the check ran
 * And the Accounting Officer's verdict on a flag:
 *  - ai_review_finding: valid_high (approved anyway) | needs_changes (returned) | false_alarm (flag cleared)
 *  - ai_reviewed_by / ai_reviewed_at
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('vouchers', function (Blueprint $t) {
            $t->json('ai_check_signals')->nullable()->after('ai_anomaly_reason');
            $t->string('ai_check_source', 20)->nullable()->after('ai_check_signals');
            $t->timestamp('ai_checked_at')->nullable()->after('ai_check_source');
            $t->enum('ai_review_finding', ['valid_high', 'needs_changes', 'false_alarm'])->nullable()->after('ai_checked_at');
            $t->foreignId('ai_reviewed_by')->nullable()->after('ai_review_finding')->constrained('users')->nullOnDelete();
            $t->timestamp('ai_reviewed_at')->nullable()->after('ai_reviewed_by');
            $t->index(['company_id', 'ai_anomaly_flag', 'status'], 'vouchers_flag_queue_index');
        });
    }

    public function down(): void
    {
        Schema::table('vouchers', function (Blueprint $t) {
            $t->dropIndex('vouchers_flag_queue_index');
            $t->dropConstrainedForeignId('ai_reviewed_by');
            $t->dropColumn(['ai_check_signals', 'ai_check_source', 'ai_checked_at', 'ai_review_finding', 'ai_reviewed_at']);
        });
    }
};
