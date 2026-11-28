<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Cheque register (user decisions 2026-11-29): one row per cheque written for an APPROVED cheque voucher.
 * A separate table so a cancelled or stale cheque stays in the history when a replacement is written; at most one
 * "live" cheque (issued / released / cleared) per voucher, checked in code under a row lock.
 *
 *   issued   → recorded: the cheque is written and signed, not handed over yet
 *   released → given to the payee (received_by + released_at)
 *   cleared  → the bank paid it (cleared_on, from the bank statement)
 *   stale    → not cleared 180 days after its date (a daily job; Philippine practice)
 *   cancelled→ voided (reason); a replacement cheque can then be recorded
 *
 * amount + payee_name are copied from the voucher when recorded, so the register reads the same later.
 * notifications.type also allows 'cheque_stale' (warning 30 days before + the "marked stale" notice).
 */
return new class extends Migration
{
    private const OLD_TYPES = "'voucher_approved','voucher_rejected','voucher_pending','anomaly_flagged','budget_alert',"
        ."'security_alert','access_changed','user_changed','department_alert','company_changed','system_alert',"
        ."'draft_expiry','support_request','voucher_returned','budget_change','report_ready','report_signoff'";

    public function up(): void
    {
        Schema::create('cheques', function (Blueprint $t) {
            $t->id();
            $t->foreignId('company_id')->constrained('companies')->restrictOnDelete();
            $t->foreignId('voucher_id')->constrained('vouchers')->restrictOnDelete();
            $t->string('cheque_number', 30)->comment('As printed on the cheque');
            $t->date('cheque_date')->comment('The date written on the cheque; stale 180 days after it');
            $t->string('bank_name', 150)->comment('The bank the cheque is drawn on (the company account)');
            $t->decimal('amount', 15, 2)->comment('Copied from the voucher when recorded');
            $t->string('payee_name', 255)->comment('Copied from the voucher when recorded');
            $t->enum('status', ['issued', 'released', 'cleared', 'stale', 'cancelled'])->default('issued');
            $t->string('received_by', 150)->nullable()->comment('Who picked the cheque up');
            $t->timestamp('released_at')->nullable();
            $t->foreignId('released_by')->nullable()->constrained('users')->restrictOnDelete();
            $t->date('cleared_on')->nullable()->comment('The day the bank paid it');
            $t->foreignId('cleared_by')->nullable()->constrained('users')->restrictOnDelete();
            $t->timestamp('cancelled_at')->nullable();
            $t->foreignId('cancelled_by')->nullable()->constrained('users')->restrictOnDelete();
            $t->string('cancel_reason', 255)->nullable();
            $t->timestamp('stale_warned_at')->nullable()->comment('The 30-days-before reminder was sent');
            $t->timestamp('stale_at')->nullable();
            $t->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $t->timestamps();

            // One cheque number per bank within a company (cheque books are per bank account)
            $t->unique(['company_id', 'bank_name', 'cheque_number'], 'cheques_company_bank_number_unique');
            $t->index(['company_id', 'status', 'cheque_date'], 'cheques_company_status_date_index');
        });

        DB::statement('ALTER TABLE `notifications` MODIFY `type` ENUM('.self::OLD_TYPES.",'cheque_stale') NOT NULL");
    }

    public function down(): void
    {
        DB::table('notifications')->where('type', 'cheque_stale')->delete();
        DB::statement('ALTER TABLE `notifications` MODIFY `type` ENUM('.self::OLD_TYPES.') NOT NULL');
        Schema::dropIfExists('cheques');
    }
};
