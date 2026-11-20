<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Security alerts (Framer mQcXDCyDZ panel + SCoT_cu7B detail), approved by the user 2026-11-20.
 *
 * ONE row per suspicious thing, SHARED by every Super Admin: when one of them reviews it,
 * the others see "reviewed by …". (Notifications are personal per person, so they can't do that.)
 *
 *   type        failed_sign_ins | new_device_sign_in | password_changed | super_admin_added
 *   severity    high | medium | low
 *   status      open (= "Not reviewed") | reviewed | dismissed
 *   details     JSON, e.g. the list of failed attempts shown in "What happened"
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('security_alerts', function (Blueprint $table) {
            $table->id();
            $table->string('type', 40);
            $table->enum('severity', ['high', 'medium', 'low']);
            $table->enum('status', ['open', 'reviewed', 'dismissed'])->default('open');
            // The account it's about. NULL when someone typed an email that doesn't exist.
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('subject_email', 255)->comment('The email typed / the account email, kept even if the account is gone');
            $table->string('ip_address', 45)->nullable();
            $table->string('device', 100)->nullable()->comment('e.g. "Chrome on Windows"');
            $table->unsignedInteger('event_count')->default(1);
            $table->timestamp('first_seen_at')->nullable();
            $table->timestamp('last_seen_at')->nullable();
            $table->json('details')->nullable();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();

            $table->index(['status', 'created_at']);
            $table->index(['type', 'subject_email', 'status']); // "is there already an open alert for this email?"
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('security_alerts');
    }
};
