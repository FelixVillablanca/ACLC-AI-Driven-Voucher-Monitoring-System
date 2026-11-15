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
        Schema::create('ai_forecasts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->onDelete('cascade');
            $table->foreignId('department_id')->constrained('departments')->onDelete('cascade');
            $table->date('forecast_for_month')->comment('The month being predicted (first day of month)');
            $table->decimal('predicted_spend', 15, 2)->comment('AI-predicted total spending');
            $table->decimal('confidence_score', 5, 4);
            $table->string('model_version')->comment('Version of the AI model used for prediction');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('ai_forecasts');
    }
};
