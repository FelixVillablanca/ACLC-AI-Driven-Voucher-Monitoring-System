<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Adds 'returned' to vouchers.status (user decision 2026-11-22, for the clerk's "Returned to you").
 *
 * The voucher flow (agreed the same day):
 *   draft → pending (with the Accounting Officer, step 1) → under_review (with the Supervisor, step 2)
 *         → approved | rejected
 *   pending / under_review → returned (sent back to the clerk with a note) → the clerk fixes it → pending
 *   draft / returned → cancelled
 * The reviewer's note stays in voucher_approvals (action 'returned', remarks).
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE vouchers MODIFY status ENUM('draft','pending','under_review','returned','approved','rejected','cancelled') NOT NULL");
    }

    public function down(): void
    {
        if (DB::table('vouchers')->where('status', 'returned')->exists()) {
            throw new RuntimeException("Can't remove 'returned': some vouchers are returned. Move them back to draft first.");
        }

        DB::statement("ALTER TABLE vouchers MODIFY status ENUM('draft','pending','under_review','approved','rejected','cancelled') NOT NULL");
    }
};
