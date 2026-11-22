<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Blocked addresses (Framer AL2 "Block this IP" + AL8 "Block 180.190.77.4?"), approved by the user 2026-11-21.
 *
 * One row per block. A block is ACTIVE while unblocked_at is NULL and (expires_at is NULL or in the
 * future). Sign-ins from an active blocked address are refused (BlockedAddresses). Rows are never
 * deleted: an unblock fills unblocked_at / unblocked_by, so the history stays.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('blocked_ips', function (Blueprint $table) {
            $table->id();
            $table->string('ip_address', 45)->comment('IPv4 or IPv6');
            $table->text('reason');
            $table->timestamp('expires_at')->nullable()->comment('NULL = until a Super Admin unblocks it');
            $table->foreignId('blocked_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('unblocked_at')->nullable();
            $table->foreignId('unblocked_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['ip_address', 'unblocked_at', 'expires_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('blocked_ips');
    }
};
