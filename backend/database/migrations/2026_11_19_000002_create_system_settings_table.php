<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Global settings owned by the Super Admin (docx §4.3 / §4.9, Framer tsrXCiWWw):
 * high-value threshold, AI sensitivity, OpenAI cap, session policy, ...
 * One row per setting ("key/value" table), so a new setting needs no new migration.
 * Who changed what and why is recorded in audit_logs (the "Change history" panel).
 * Approved by the user on 2026-11-19.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('system_settings', function (Blueprint $table) {
            $table->id();
            $table->string('key', 100)->unique()->comment('e.g. approval.high_value_threshold, ai.anomaly_sensitivity, openai.monthly_cap');
            $table->json('value')->nullable()->comment('JSON so numbers, booleans and text all fit');
            $table->string('group', 50)->default('general')->index()->comment('approval, ai, openai, security, backups (the Global settings sections)');
            $table->string('description')->nullable();
            $table->foreignId('updated_by')->nullable()->comment('Super Admin who last changed it')
                ->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('system_settings');
    }
};
