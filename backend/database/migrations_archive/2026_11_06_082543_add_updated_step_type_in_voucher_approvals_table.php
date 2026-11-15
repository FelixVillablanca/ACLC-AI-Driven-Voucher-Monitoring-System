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
            $table->tinyInteger('step')->default(1)->after('approver_id')->comment('Step of the approval process, 1 = accounting, 2 = supervisor_manager');
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
