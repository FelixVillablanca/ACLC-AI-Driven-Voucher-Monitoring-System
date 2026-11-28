<?php

namespace App\Domain\Identity\Actions;

use App\Domain\Audit\AuditTrail;
use App\Domain\Identity\Queries\UnassignedAdmins;
use App\Domain\Security\Support\OwnerActivity;
use App\Mail\UnassignedAdminRemovedMail;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

/**
 * php artisan admins:expire-unassigned (every 5 minutes, routes/console.php). User decisions 2026-11-28:
 * an Admin created with "No company yet" has 24 hours to be given one.
 *  - WARN_HOURS (3 h) before: every active Super Admin gets a bell notice (once per Admin)
 *  - at 24 h, still no company:
 *      never used (no history points at them)  -> DELETED, so the work email is free again
 *      already used (e.g. they signed in: the append-only audit log keeps their rows) -> DEACTIVATED and signed out
 *    + an audit row by "System", a bell notice to every active Super Admin, and an email to the Admin's personal email
 * Each account is re-checked under a row lock, so one given a company a moment ago is left alone.
 */
class ExpireUnassignedAdmins
{
    /** @return array{warned: int, deleted: int, deactivated: int} */
    public function handle(): array
    {
        $result = ['warned' => $this->warn(), 'deleted' => 0, 'deactivated' => 0];

        $due = UnassignedAdmins::query()
            ->where('created_at', '<=', now()->subHours(UnassignedAdmins::GRACE_HOURS))
            ->pluck('id');

        foreach ($due as $id) {
            $outcome = $this->expire((int) $id);
            if ($outcome) {
                $result[$outcome]++;
            }
        }

        return $result;
    }

    /** The 3-hour warning to the Super Admins (once per Admin: a cache key remembers it was sent). */
    private function warn(): int
    {
        $soon = UnassignedAdmins::query()
            ->where('created_at', '<=', now()->subHours(UnassignedAdmins::GRACE_HOURS - UnassignedAdmins::WARN_HOURS))
            ->where('created_at', '>', now()->subHours(UnassignedAdmins::GRACE_HOURS))
            ->get();

        $sent = 0;
        foreach ($soon as $admin) {
            if (! Cache::add("unassigned-admin-warned:{$admin->id}:{$admin->created_at->timestamp}", true, now()->addDays(2))) {
                continue;
            }
            $at = UnassignedAdmins::deadlineFor($admin)->format('M j, g:i A');
            $this->tellOwners('Admin account removed soon',
                "{$admin->full_name} ({$admin->email}) still has no company and will be removed at {$at}. "
                .'Give them one in + Add company or Edit details to keep the account.');
            $sent++;
        }

        return $sent;
    }

    /** @return 'deleted'|'deactivated'|null (null = given a company / changed meanwhile: left alone) */
    private function expire(int $id): ?string
    {
        $done = DB::transaction(function () use ($id) {
            $admin = UnassignedAdmins::query()->whereKey($id)
                ->where('created_at', '<=', now()->subHours(UnassignedAdmins::GRACE_HOURS))
                ->lockForUpdate()->first();
            if (! $admin) {
                return null;
            }

            $snapshot = [
                'employee_id' => $admin->employee_id,
                'name' => $admin->full_name,
                'email' => $admin->email,
                'personal_email' => $admin->personal_email,
                'created_at' => $admin->created_at->toIso8601String(),
            ];

            $outcome = $this->deleteIfUnused($admin) ? 'deleted' : 'deactivated';
            if ($outcome === 'deactivated') {
                $admin->forceFill(['is_active' => false, 'deactivated_at' => now()])->save();
                OwnerActivity::signOutEverywhere($admin);
            }

            AuditTrail::record([
                'user_id' => null, // System
                'company_id' => null,
                'action' => "unassigned_admin_{$outcome}",
                'table_name' => 'users',
                'record_id' => $admin->id,
                'old_values' => json_encode($snapshot),
                'new_values' => json_encode(['reason' => 'No company within '.UnassignedAdmins::GRACE_HOURS.' hours', 'outcome' => $outcome]),
                'ip_address' => null,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            $this->tellOwners($outcome === 'deleted' ? 'Admin account deleted' : 'Admin account deactivated',
                "{$snapshot['name']} ({$snapshot['email']}) had no company after ".UnassignedAdmins::GRACE_HOURS.' hours, so the account was '
                .($outcome === 'deleted' ? 'deleted (it was never used).' : 'deactivated (it was already used, so its history is kept).'));

            return ['outcome' => $outcome, 'snapshot' => $snapshot, 'first_name' => $admin->first_name];
        });

        if (! $done) {
            return null;
        }

        // after the commit: a failed email never undoes the removal
        if ($done['snapshot']['personal_email']) {
            try {
                Mail::to($done['snapshot']['personal_email'])->send(new UnassignedAdminRemovedMail(
                    $done['first_name'], $done['snapshot']['email'], $done['outcome'] === 'deleted', UnassignedAdmins::GRACE_HOURS,
                ));
            } catch (\Throwable $e) {
                Log::warning('Could not email a removed unassigned Admin', ['error' => $e->getMessage()]);
            }
        }

        return $done['outcome'];
    }

    /** Deletes the account inside a savepoint; false when something (e.g. their audit rows) still points at it. */
    private function deleteIfUnused(User $admin): bool
    {
        try {
            DB::transaction(function () use ($admin) {
                DB::table('password_reset_tokens')->where('email', $admin->email)->delete();
                DB::table('notifications')->where('recipient_id', $admin->id)->delete();
                DB::table('user_company_access')->where('user_id', $admin->id)->delete();
                DB::table('sessions')->where('user_id', $admin->id)->delete();
                $admin->delete();
            });

            return true;
        } catch (QueryException) {
            return false;
        }
    }

    private function tellOwners(string $title, string $message): void
    {
        User::where('role', 'super_admin')->where('is_active', true)->pluck('id')
            ->each(fn (int $id) => Notification::create([
                'recipient_id' => $id, 'type' => 'user_changed', 'title' => $title, 'message' => $message,
            ]));
    }
}
