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
        Schema::create('budget_allocations', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('company_id');
            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade');
            $table->unsignedBigInteger('department_id');
            $table->foreign('department_id')->references('id')->on('departments')->onDelete('cascade');
            $table->year('fiscal_year')->comment('Fiscal year for which the budget allocation is made. Fiscal year, e.g., 2025');
            $table->tinyInteger('fiscal_month')->comment('Fiscal month for which the budget allocation is made. Fiscal month, e.g., 1 for January, 2 for February, etc.');
            $table->decimal('total_budget', 15, 2)->comment('Total budget allocated for the specified fiscal year and month');
            $table->decimal('used_amount', 15, 2)->default(0.00)->comment('Amount of the budget that has been used or spent');
            $table->decimal('alert_threshold_pct', 5, 2)->default(80.00)->comment('Percentage threshold for budget alert. When the used amount reaches this percentage of the total budget, an alert is triggered.');
            $table->unsignedBigInteger('created_by')->nullable();
            $table->foreign('created_by')->references('id')->on('users')->onDelete('set null');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('budget_allocations');
    }
};
