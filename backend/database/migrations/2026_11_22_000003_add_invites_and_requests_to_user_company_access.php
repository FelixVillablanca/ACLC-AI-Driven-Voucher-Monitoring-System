<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Invites and requests between companies (user-approved 2026-11-22).
 *
 * One user_company_access row per person + company, now also saying HOW it started:
 *   kind = grant    the company's Admin gave access directly (Create user, Grant access)
 *          invite   the Admin invited someone from another company → THAT PERSON accepts / declines
 *          request  a clerk / officer / supervisor asked to join → the company's ADMIN approves / declines
 * granted_status keeps its meaning: pending (waiting for the answer) | accepted | denied.
 *   requested_by   who started it (the Admin for an invite, the person for a request)
 *   message        an optional note with the invite / request
 *   responded_at / responded_by   who answered, and when
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('user_company_access', function (Blueprint $table) {
            $table->enum('kind', ['grant', 'invite', 'request'])->default('grant')->after('granted_status')
                ->comment('grant = Admin gave it; invite = Admin asked the person; request = the person asked the Admin');
            $table->foreignId('requested_by')->nullable()->after('kind')->constrained('users')->nullOnDelete();
            $table->string('message', 500)->nullable()->after('requested_by');
            $table->timestamp('responded_at')->nullable()->after('message');
            $table->foreignId('responded_by')->nullable()->after('responded_at')->constrained('users')->nullOnDelete();

            $table->index(['company_id', 'granted_status', 'kind']);
        });
    }

    public function down(): void
    {
        Schema::table('user_company_access', function (Blueprint $table) {
            $table->dropIndex(['company_id', 'granted_status', 'kind']);
            $table->dropConstrainedForeignId('responded_by');
            $table->dropColumn('responded_at');
            $table->dropColumn('message');
            $table->dropConstrainedForeignId('requested_by');
            $table->dropColumn('kind');
        });
    }
};
