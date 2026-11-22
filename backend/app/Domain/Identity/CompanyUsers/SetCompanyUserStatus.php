<?php

namespace App\Domain\Identity\CompanyUsers;

use App\Domain\Audit\AuditTrail;
use App\Domain\Security\Support\OwnerActivity;
use App\Domain\Tenancy\Support\AdminCompany;
use App\Exceptions\ApiException;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Deactivate / reactivate a clerk, officer or supervisor (Users page). Never deletes:
 * their vouchers, approvals and history stay linked to them.
 * Deactivated = can't sign in, signed out everywhere at once. 409 when already in that state.
 */
class SetCompanyUserStatus
{
    public function handle(User $target, bool $active, ?string $reason, User $admin, ?string $ip = null): User
    {
        AdminCompany::activeFor($admin, 'user changes');

        return DB::transaction(function () use ($target, $active, $reason, $admin, $ip) {
            /** @var User $target */
            $target = User::whereKey($target->id)->lockForUpdate()->firstOrFail();

            if ((bool) $target->is_active === $active) {
                throw new ApiException(
                    $active ? "{$target->full_name} is already active." : "{$target->full_name} is already deactivated.",
                    $active ? 'USER_ALREADY_ACTIVE' : 'USER_ALREADY_INACTIVE',
                    409,
                );
            }

            $target->forceFill(['is_active' => $active, 'deactivated_at' => $active ? null : now()])->save();
            if (! $active) {
                OwnerActivity::signOutEverywhere($target);
            }

            AuditTrail::record([
                'user_id' => $admin->id,
                'company_id' => $target->company_id,
                'action' => $active ? 'account_reactivated' : 'account_deactivated',
                'table_name' => 'users',
                'record_id' => $target->id,
                'old_values' => ['is_active' => ! $active],
                'new_values' => array_filter([
                    'first_name' => $target->first_name, 'last_name' => $target->last_name, 'is_active' => $active, 'reason' => $reason,
                ], fn ($v) => $v !== null),
                'ip_address' => $ip,
            ]);

            User::where('role', 'admin')->where('company_id', $target->company_id)->whereKeyNot($admin->id)->pluck('id')
                ->each(fn (int $id) => Notification::create([
                    'recipient_id' => $id,
                    'type' => 'user_changed',
                    'title' => $active ? 'User reactivated' : 'User deactivated',
                    'message' => "{$admin->full_name} ".($active ? 'reactivated' : 'deactivated')." {$target->full_name}.".($reason ? " Reason: \"{$reason}\"" : ''),
                ]));

            return $target;
        });
    }
}
