<?php

namespace App\Domain\Tenancy\Actions;

use App\Domain\Audit\AuditTrail;
use App\Domain\Tenancy\Support\AdminCompany;
use App\Exceptions\ApiException;
use App\Models\Department;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Deactivate / reactivate a department (a department is never deleted: vouchers and history point at it).
 *
 * Deactivated = hidden from the department choices for NEW users (Create user, lookups),
 * but the people already in it stay there, and everything they did stays linked to it.
 * 409 when it's already in that state (e.g. another Admin just did it).
 */
class SetDepartmentStatus
{
    /** @return array{department: Department, people: int} */
    public function handle(Department $department, bool $active, ?string $reason, User $admin, ?string $ip = null): array
    {
        AdminCompany::activeFor($admin, 'department changes');

        return DB::transaction(function () use ($department, $active, $reason, $admin, $ip) {
            /** @var Department $department */
            $department = Department::whereKey($department->id)->lockForUpdate()->firstOrFail();

            if ((bool) $department->is_active === $active) {
                throw new ApiException(
                    $active ? "{$department->name} is already active." : "{$department->name} is already deactivated.",
                    $active ? 'DEPARTMENT_ALREADY_ACTIVE' : 'DEPARTMENT_ALREADY_INACTIVE',
                    409,
                );
            }

            $department->forceFill(['is_active' => $active])->save();
            $people = User::where('department_id', $department->id)->where('role', '!=', 'super_admin')->count();

            AuditTrail::record([
                'user_id' => $admin->id,
                'company_id' => $department->company_id,
                'action' => $active ? 'department_reactivated' : 'department_deactivated',
                'table_name' => 'departments',
                'record_id' => $department->id,
                'old_values' => ['is_active' => ! $active],
                'new_values' => array_filter(['name' => $department->name, 'is_active' => $active, 'reason' => $reason, 'people' => $people], fn ($v) => $v !== null),
                'ip_address' => $ip,
            ]);

            User::where('role', 'admin')->where('company_id', $department->company_id)->whereKeyNot($admin->id)->pluck('id')
                ->each(fn (int $id) => Notification::create([
                    'recipient_id' => $id,
                    'type' => 'department_alert',
                    'title' => $active ? 'Department reactivated' : 'Department deactivated',
                    'message' => "{$admin->full_name} ".($active ? 'reactivated' : 'deactivated')." {$department->name}.".($reason ? " Reason: \"{$reason}\"" : ''),
                ]));

            return ['department' => $department, 'people' => $people];
        });
    }
}
