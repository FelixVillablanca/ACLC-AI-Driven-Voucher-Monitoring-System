<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Idempotency keys (Phase 7 step 1, approved by the user 2026-11-28). The React app sends an Idempotency-Key on every
 * POST and re-uses it when the same request is sent again within 10 s (a double-click, a retry). The server keeps the
 * first answer here for 24 h: the same key again gets that answer back instead of doing the work twice
 * (App\Http\Middleware\EnsureIdempotency).
 *  - one row per user + key; request_hash = what was asked (method, path, company, body), so a key re-used for a
 *    DIFFERENT request is refused (422 IDEMPOTENCY_KEY_REUSED)
 *  - status_code NULL = the first request is still running (a second one meanwhile gets 409 REQUEST_IN_PROGRESS)
 *  - only successful answers are kept; a failed one deletes its row, so the person can simply try again
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('idempotency_keys', function (Blueprint $t) {
            $t->id();
            $t->foreignId('user_id')->constrained()->cascadeOnDelete();
            $t->string('key', 100);
            $t->string('method', 10);
            $t->string('path', 255);
            $t->char('request_hash', 64);
            $t->unsignedSmallInteger('status_code')->nullable()->comment('NULL while the first request is still running');
            $t->longText('response_body')->nullable();
            // dateTime, not timestamp: on MariaDB 10.4 the first TIMESTAMP column updates itself on every UPDATE
            $t->dateTime('expires_at')->index();
            $t->timestamps();
            $t->unique(['user_id', 'key'], 'idempotency_keys_user_key_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('idempotency_keys');
    }
};
