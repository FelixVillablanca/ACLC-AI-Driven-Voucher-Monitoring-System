<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Accounting Officer Budgets (Framer AwnFnuBYJ overview, kpJmhDxKE department, MGf9CXv2s edit), approved by the
 * user 2026-11-27:
 *  - budgets are YEARLY: one row per department per fiscal year. fiscal_month becomes optional (left empty);
 *    a UNIQUE index stops a second budget for the same department + year. (0 budget rows existed.)
 *  - budget_allocations.alert_sent_at: when usage passed the alert % (the "over since Oct 28" line, and so the
 *    alert is sent once); updated_by: who changed it last.
 *  - budget_change_requests: an edit bigger than the Global setting "budget.change_signoff_above" (₱250,000)
 *    waits here for a Supervisor's sign-off (the Supervisor's screen comes with the Supervisor pages).
 *  - notifications.type also allows 'budget_change' (Supervisors: a change is waiting). MODIFY only widens it.
 */
return new class extends Migration
{
    private const OLD_TYPES = "'voucher_approved','voucher_rejected','voucher_pending','anomaly_flagged','budget_alert',"
        ."'security_alert','access_changed','user_changed','department_alert','company_changed','system_alert','draft_expiry',"
        ."'support_request','voucher_returned'";

    public function up(): void
    {
        Schema::table('budget_allocations', function (Blueprint $t) {
            $t->tinyInteger('fiscal_month')->nullable()->comment('Not used since 2026-11-27: budgets are yearly (left empty)')->change();
            $t->timestamp('alert_sent_at')->nullable()->after('alert_threshold_pct')->comment('When usage passed the alert %, empty while below it');
            $t->foreignId('updated_by')->nullable()->after('created_by')->constrained('users')->nullOnDelete();
            $t->unique(['company_id', 'department_id', 'fiscal_year'], 'budget_allocations_department_year_unique');
        });

        Schema::create('budget_change_requests', function (Blueprint $t) {
            $t->id();
            $t->foreignId('company_id')->constrained()->cascadeOnDelete();
            $t->foreignId('budget_allocation_id')->constrained()->cascadeOnDelete();
            $t->decimal('current_budget', 15, 2)->comment('The allocation when the request was made');
            $t->decimal('requested_budget', 15, 2);
            $t->decimal('current_alert_pct', 5, 2);
            $t->decimal('requested_alert_pct', 5, 2);
            $t->string('reason', 500);
            $t->enum('status', ['pending', 'approved', 'declined', 'cancelled'])->default('pending');
            $t->foreignId('requested_by')->nullable()->constrained('users')->nullOnDelete();
            $t->foreignId('decided_by')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamp('decided_at')->nullable();
            $t->string('decision_note', 500)->nullable();
            $t->timestamps();
            $t->index(['budget_allocation_id', 'status']);
            $t->index(['company_id', 'status']);
        });

        DB::statement('ALTER TABLE `notifications` MODIFY `type` ENUM('.self::OLD_TYPES.",'budget_change') NOT NULL");
    }

    public function down(): void
    {
        DB::table('notifications')->where('type', 'budget_change')->delete();
        DB::statement('ALTER TABLE `notifications` MODIFY `type` ENUM('.self::OLD_TYPES.') NOT NULL');

        Schema::dropIfExists('budget_change_requests');

        DB::table('budget_allocations')->whereNull('fiscal_month')->update(['fiscal_month' => 1]);
        Schema::table('budget_allocations', function (Blueprint $t) {
            $t->dropUnique('budget_allocations_department_year_unique');
            $t->dropConstrainedForeignId('updated_by');
            $t->dropColumn('alert_sent_at');
            $t->tinyInteger('fiscal_month')->nullable(false)->comment('Fiscal month for which the budget allocation is made. Fiscal month, e.g., 1 for January, 2 for February, etc.')->change();
        });
    }
};
