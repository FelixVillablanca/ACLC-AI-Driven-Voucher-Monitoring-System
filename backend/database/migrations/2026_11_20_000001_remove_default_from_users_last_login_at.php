<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * users.last_login_at had DEFAULT current_timestamp(), so every NEW user looked like they had
 * already signed in at the moment they were created. The Super Admin page then showed them as
 * "Active · Signed in …" instead of "Pending · not signed in yet".
 *
 * After this, a new user's last_login_at is NULL until their first real sign-in
 * (AuthenticateUser sets it). Approved by the user on 2026-11-20.
 *
 * Existing rows are NOT changed: we can't tell a real sign-in time from a filled-in default.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement('ALTER TABLE `users` MODIFY `last_login_at` TIMESTAMP NULL DEFAULT NULL');
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE `users` MODIFY `last_login_at` TIMESTAMP NULL DEFAULT current_timestamp()');
    }
};
