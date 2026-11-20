<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Database backups (Framer TKziMjHUe "Run a database backup now?"), approved by the user 2026-11-21.
 *
 * 1. NEW table `backups`: one row per backup run (nightly or "Run backup now").
 *      status   queued -> running -> succeeded | failed
 *      trigger  scheduled (02:00 every night) | manual (a Super Admin clicked)
 * 2. notifications.type also allows 'system_alert' ("Backup finished" / "Backup failed").
 *    MODIFY on an ENUM only widens the list, so existing rows are untouched.
 */
return new class extends Migration
{
    private const OLD_TYPES = "'voucher_approved','voucher_rejected','voucher_pending','anomaly_flagged','budget_alert',"
        ."'security_alert','access_changed','user_changed','department_alert','company_changed'";

    public function up(): void
    {
        Schema::create('backups', function (Blueprint $table) {
            $table->id();
            $table->enum('status', ['queued', 'running', 'succeeded', 'failed'])->default('queued');
            $table->enum('trigger', ['scheduled', 'manual']);
            $table->foreignId('requested_by')->nullable()->constrained('users')->nullOnDelete()->comment('NULL = the nightly schedule');
            $table->boolean('notify_requester')->default(false)->comment('"Notify me when it finishes"');
            $table->string('file_path', 255)->nullable()->comment('Inside storage/app/private, never reachable from the web');
            $table->unsignedBigInteger('size_bytes')->nullable()->comment('Size of the compressed file');
            $table->unsignedBigInteger('database_size_bytes')->nullable()->comment('Size of the database when it started');
            $table->timestamp('started_at')->nullable();
            $table->timestamp('finished_at')->nullable();
            $table->text('error')->nullable();
            $table->timestamps();

            $table->index(['status', 'finished_at']);
        });

        DB::statement('ALTER TABLE `notifications` MODIFY `type` ENUM('.self::OLD_TYPES.",'system_alert') NOT NULL");
    }

    public function down(): void
    {
        DB::table('notifications')->where('type', 'system_alert')->delete();
        DB::statement('ALTER TABLE `notifications` MODIFY `type` ENUM('.self::OLD_TYPES.') NOT NULL');

        Schema::dropIfExists('backups');
    }
};
