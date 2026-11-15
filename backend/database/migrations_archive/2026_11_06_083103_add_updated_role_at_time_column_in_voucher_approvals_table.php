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
            $table->enum('role_at_time', ['Accounting', 'Supervisor Manager'])->default('Accounting')->comment('Role of the approver at the time of approval, either Accounting or Supervisor Manager')->after('step');
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
