<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * System health tab (Framer m80KDanOj + SH1–SH10), approved by the user 2026-11-21.
 *
 * 1. health_checks  every minute the scheduler checks each service and writes one row per service
 *                   (status + response time + a few numbers). Measurements, not audit records:
 *                   rows older than 90 days are deleted every night.
 * 2. incidents      opened automatically when a service is unhealthy for 3 checks in a row
 *                   (open → watching once it recovers → resolved by a Super Admin with a note).
 *                   `timeline` keeps what happened, in order.
 * 3. blocked_ips.watch_until  SH9 "Watch it for 24 hours": after an unblock, 3 more failed
 *                   sign-ins from that address block it again automatically.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('health_checks', function (Blueprint $table) {
            $table->id();
            $table->string('service', 20)->comment('web, database, queue, scheduler, ml, backup');
            $table->string('status', 20)->comment('ok | warning | danger | not_configured');
            $table->unsignedInteger('latency_ms')->nullable()->comment('How long the check took to answer');
            $table->json('metrics')->nullable()->comment('e.g. {"waiting":14,"failed":5} for the queue');
            $table->timestamp('checked_at');

            $table->index(['service', 'checked_at']);
            $table->index('checked_at');
        });

        Schema::create('incidents', function (Blueprint $table) {
            $table->id();
            $table->string('service', 20);
            $table->string('title', 160);
            $table->enum('status', ['open', 'watching', 'resolved'])->default('open');
            $table->string('severity', 20)->default('warning')->comment('warning (slow) | danger (down)');
            $table->timestamp('started_at');
            $table->timestamp('recovered_at')->nullable()->comment('When the checks came back healthy');
            $table->timestamp('resolved_at')->nullable();
            $table->foreignId('resolved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('closing_note')->nullable();
            $table->json('timeline')->nullable()->comment('[{at, text}] in order');
            $table->timestamps();

            $table->index(['service', 'status']);
            $table->index('started_at');
        });

        Schema::table('blocked_ips', function (Blueprint $table) {
            $table->timestamp('watch_until')->nullable()->after('unblocked_by')
                ->comment('After an unblock: 3 failed sign-ins before this time block it again');
        });
    }

    public function down(): void
    {
        Schema::table('blocked_ips', fn (Blueprint $table) => $table->dropColumn('watch_until'));
        Schema::dropIfExists('incidents');
        Schema::dropIfExists('health_checks');
    }
};
