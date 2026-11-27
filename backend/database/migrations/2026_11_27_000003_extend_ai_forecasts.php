<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Forecasts (Framer GWmqqOmd7 overview, sjtX1kKqt department), approved by the user 2026-11-27.
 * Until Phase 5's Python model, Laravel fits a straight-line trend (linear regression) to each department's
 * approved spending per month and stores the next months here.
 *  - department_id becomes optional: an empty one = the whole company's forecast
 *  - lower_bound / upper_bound: the likely range (80%); r_squared: how well the line fits (0–1);
 *    months_used: how many months of history; method: 'linear_trend' now, 'model' when the ML service takes over;
 *    generated_at: when it was worked out
 *  - one forecast per company + department + month (department rows; company rows are kept unique in code,
 *    because a UNIQUE index lets several empty department_ids through)
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('ai_forecasts', function (Blueprint $t) {
            $t->foreignId('department_id')->nullable()->comment('Empty = the whole company')->change();
            $t->decimal('lower_bound', 15, 2)->default(0)->after('predicted_spend');
            $t->decimal('upper_bound', 15, 2)->default(0)->after('lower_bound');
            $t->decimal('r_squared', 5, 4)->nullable()->after('confidence_score')->comment('How well the trend line fits, 0–1');
            $t->unsignedTinyInteger('months_used')->default(0)->after('r_squared');
            $t->string('method', 30)->default('linear_trend')->after('months_used')->comment('linear_trend (Laravel) | model (Phase 5 ML service)');
            $t->timestamp('generated_at')->nullable()->after('model_version');
            $t->unique(['company_id', 'department_id', 'forecast_for_month'], 'ai_forecasts_company_department_month_unique');
        });
    }

    public function down(): void
    {
        DB::table('ai_forecasts')->whereNull('department_id')->delete();
        Schema::table('ai_forecasts', function (Blueprint $t) {
            $t->dropUnique('ai_forecasts_company_department_month_unique');
            $t->dropColumn(['lower_bound', 'upper_bound', 'r_squared', 'months_used', 'method', 'generated_at']);
            $t->foreignId('department_id')->nullable(false)->change();
        });
    }
};
