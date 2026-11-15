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
        Schema::table('users', function (Blueprint $table) {
            //
            // $table->string('employee_id', 50)->after('name')->unique()->nullable();
            // $table->string('first_name', 100)->after('employee_id')->nullable();
            // $table->string('last_name', 100)->after('first_name')->nullable();
            // $table->string('email')->unique()->after('last_name');
            // $table->timestamp('email_verified_at')->nullable()->after('email');
            // $table->string('password')->after('email_verified_at');
            // $table->enum('is_active', ['active', 'offline', 'suspended'])->after('password')->default('offline');
            $table->enum('access_status', ['accepted', 'pending', 'rejected'])->after('is_active')->default('pending');
            $table->enum('role', ['admin', 'accounting_clerk', 'accounting_officer', 'supervisor_manager'])->after('access_status');
            $table->foreignId('department_id')->nullable()->after('role')->constrained('departments')->onDelete('set null');
            $table->foreignId('company_id')->nullable()->after('department_id')->constrained('companies')->onDelete('set null');
            $table->string('profile_photo', 500)->after('company_id')->nullable();
            $table->timestamp('last_login_at')->nullable()->useCurrent()->after('profile_photo');

        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            //
        });
    }
};
