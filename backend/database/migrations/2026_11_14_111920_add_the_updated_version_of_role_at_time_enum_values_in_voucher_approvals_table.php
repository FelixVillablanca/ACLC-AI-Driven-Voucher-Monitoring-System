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
        Schema::table('voucher_approvals', function (Blueprint $table) {
            //
            $table->enum('role_at_time', ["accounting_officer", "supervisor_manager"])->after("step")->default("accounting_officer");
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('voucher_approvals', function (Blueprint $table) {
            //
        });
    }
};
