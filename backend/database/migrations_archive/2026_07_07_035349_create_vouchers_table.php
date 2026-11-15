<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('vouchers', function (Blueprint $table) {
            $table->id();
            $table->string('voucher_number')->unique()->required();
            $table->unsignedBigInteger('voucher_type_id')->nullable();
            $table->foreign('voucher_type_id')->references('id')->on('voucher_types')->onDelete('set null');
            $table->unsignedBigInteger('company_id')->nullable();
            $table->foreign('company_id')->references('id')->on('companies')->onDelete('set null');
            $table->unsignedBigInteger('department_id')->nullable();
            $table->foreign('department_id')->references('id')->on('departments')->onDelete('set null');
            $table->unsignedBigInteger('created_by')->nullable();
            $table->foreign('created_by')->references('id')->on('users')->onDelete('set null');
            $table->string('payee_name')->nullable();
            $table->unsignedBigInteger('payee_type_id')->nullable();
            $table->foreign('payee_type_id')->references('id')->on('payee_types')->onDelete('set null');
            $table->string('payee_employee_id')->nullable();
            $table->string('position')->nullable();
            $table->unsignedBigInteger('payee_department_id')->nullable();
            $table->foreign('payee_department_id')->references('id')->on('departments')->onDelete('set null');
            $table->enum('payment_method', ['cash', 'bank','cheque']);
            $table->string('bank_name')->nullable();
            $table->string('bank_account_number')->nullable();
            $table->string('bank_account_name')->nullable();
            $table->text('description')->nullable();
            $table->text('purpose')->nullable();
            $table->foreignId('category_id')->constrained('voucher_categories');
            $table->string('reference_number')->nullable();
            $table->date('period_start')->nullable()->comment('Start date of the period for which the voucher is issued');
            $table->date('period_end')->nullable()->comment('End date of the period for which the voucher is issued');
            $table->date('due_date')->nullable()->comment('Due date for payment of the voucher');   
            $table->enum('priority', ['low', 'urgent', 'normal', 'high'])->default('normal')->comment('Priority level of the voucher');
            $table->decimal('amount', 15, 2)->default(0.00)->comment('Total amount of the voucher');
            $table->string('currency')->default('PHP')->comment('Currency of the voucher amount');
            $table->text('ammount_in_words')->nullable()->comment('Amount in words for the voucher amount');    
            $table->enum('status', ['draft', 'pending', 'under_review', 'approved', 'rejected', 'cancelled']);
            $table->string('ai_category_suggestion')->nullable()->comment('AI-generated category suggestion for the voucher');
            $table->decimal('ai_category_confidence', 5, 2)->nullable()->comment('Confidence level of the AI-generated category suggestion');
            $table->tinyInteger('ai_anomaly_flag')->default(0)->comment('Flag indicating if the voucher is flagged as an anomaly by the AI');
            $table->decimal('ai_anomaly_score', 5, 2)->nullable()->comment('Anomaly score assigned by the AI to the voucher');
            $table->text('ai_anomaly_reason')->nullable()->comment('Reason provided by the AI for flagging the voucher as an anomaly');
            $table->timestamp('submitted_at')->nullable()->comment('Timestamp when the voucher was submitted for approval');
            $table->timestamp('approved_at')->nullable()->comment('Timestamp when the voucher was approved');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('vouchers');
    }
};
