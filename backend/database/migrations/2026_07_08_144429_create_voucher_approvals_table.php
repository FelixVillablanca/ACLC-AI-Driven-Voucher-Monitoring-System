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
        Schema::create('voucher_approvals', function (Blueprint $table) {
            $table->id();
            $table->foreignId('voucher_id')->constrained('vouchers')->onDelete('cascade');
            $table->unsignedBigInteger('approver_id')->nullable();
            $table->foreign('approver_id')->references('id')->on('users')->onDelete('cascade');
            $table->enum('role_at_time', ['accounting', 'supervisor_manager'])->comment('Role of the approver at the time of approval');    
            $table->enum('step', [ 1, 2])->default(1)->comment('Step of the approval process, 1 = accounting, 2 = supervisor_manager');
            $table->enum('action', ['approved', 'rejected', 'returned', 'noted']);
            $table->text('remarks')->nullable()->comment('Remarks provided by the approver during the approval process');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void 
    {
        Schema::dropIfExists('voucher_approvals');
    }
};
