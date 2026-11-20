<?php

namespace App\Domain\Identity\Actions;

use App\Domain\Identity\Support\AccountActions;
use App\Domain\Identity\Support\RoleEmailDomains;
use App\Domain\Reporting\Queries\SuperAdminDashboardSummary;
use App\Domain\Security\Actions\RaiseSecurityAlert;
use App\Domain\Security\Support\OwnerActivity;
use App\Exceptions\ApiException;
use App\Models\SecurityAlert;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * "Make Super Admin" (Admins tab A12). Approved 2026-11-21.
 *
 *   role admin → super_admin, email john.doe@Administrator.com → john.doe@Superadmin.com,
 *   they leave their company (Super Admins work outside every company), signed out everywhere
 *   (their next sign-in lands on the Super Admin console).
 *
 * Only when every check passes: a free seat (max 3, the seat rows are LOCKED while checking),
 * active, signed in within 30 days, two-step sign-in on. The request carries the password.
 * A low security alert is raised, like `superadmin:create`, because a new platform owner is sensitive.
 */
class PromoteToSuperAdmin
{
    public function __construct(private RaiseSecurityAlert $raise) {}

    public function handle(User $target, User $by, ?string $ip): User
    {
        return DB::transaction(function () use ($target, $by, $ip) {
            User::where('role', 'super_admin')->where('is_active', true)->lockForUpdate()->get(['id']);
            AccountActions::forgetSeats();

            $target = User::whereKey($target->id)->lockForUpdate()->firstOrFail();
            AccountActions::authorize($by, $target, 'make_super_admin');

            $failed = collect(AccountActions::promotionChecks($target))->firstWhere('ok', false);
            if ($failed) {
                throw new ApiException($failed['label'], 'PROMOTION_CHECK_FAILED', 409);
            }

            $newEmail = RoleEmailDomains::emailFor(strstr($target->email, '@', true), 'super_admin');
            if (User::where('email', $newEmail)->whereKeyNot($target->id)->exists()) {
                throw new ApiException("{$newEmail} is already used by another account.", 'EMAIL_TAKEN', 409);
            }

            $old = $target->only(['role', 'email', 'company_id']);
            $target->forceFill(['role' => 'super_admin', 'email' => $newEmail, 'company_id' => null])->save();
            OwnerActivity::signOutEverywhere($target);
            AccountActions::forgetSeats();

            OwnerActivity::audit($by, 'role_changed', 'users', $target->id, $old,
                $target->only(['role', 'email', 'company_id']), $ip, $old['company_id']);

            $this->raise->handle([
                'type' => SecurityAlert::TYPE_SUPER_ADMIN_ADDED,
                'severity' => 'low',
                'user_id' => $target->id,
                'subject_email' => strtolower($newEmail),
                'details' => ['via' => 'promoted by '.$by->full_name, 'seats' => SuperAdminDashboardSummary::SUPER_ADMIN_SEATS],
            ], 'New Super Admin added', "{$by->full_name} made {$target->full_name} a Super Admin ({$newEmail}).", [$by->id, $target->id]);

            return $target;
        });
    }
}
