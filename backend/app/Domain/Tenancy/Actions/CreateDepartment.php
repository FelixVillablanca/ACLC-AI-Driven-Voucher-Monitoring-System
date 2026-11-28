<?php

namespace App\Domain\Tenancy\Actions;

use App\Domain\Audit\AuditTrail;
use App\Domain\Tenancy\Support\AdminCompany;
use App\Models\Department;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * "Add department" (Admin Quick actions). One transaction: the department in the Admin's own
 * company + an audit row (shows in the dashboard's Recent activity) + a bell notice to the
 * company's other Admins. 403 NO_ACTIVE_COMPANY when the Admin has no active company.
 */
class CreateDepartment
{
    /** @param array{name: string, code: string, description?: ?string, head_user_id?: ?int} $data */
    public function handle(array $data, User $admin, ?string $ip = null): Department
    {
        $company = AdminCompany::activeFor($admin, 'departments');

        return DB::transaction(function () use ($data, $admin, $ip, $company) {
            $department = Department::create([
                'company_id' => $company->id,
                'name' => $data['name'],
                'code' => $data['code'],
                'description' => $data['description'] ?? null,
                'head_user_id' => $data['head_user_id'] ?? null,
                'is_active' => true,
            ]);

            // the head is always one of its members (2026-11-28): they join it (moved from their old department)
            app(ManageDepartmentPeople::class)->placeHeadInto($department, $department->head_user_id, $admin, $ip);

            AuditTrail::record([
                'user_id' => $admin->id,
                'company_id' => $company->id,
                'action' => 'department_created',
                'table_name' => 'departments',
                'record_id' => $department->id,
                'old_values' => null,
                'new_values' => json_encode([
                    'name' => $department->name,
                    'code' => $department->code,
                    'head_user_id' => $department->head_user_id,
                ]),
                'ip_address' => $ip,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            User::where('role', 'admin')->where('company_id', $company->id)->whereKeyNot($admin->id)->pluck('id')
                ->each(fn (int $id) => Notification::create([
                    'recipient_id' => $id,
                    'type' => 'department_alert',
                    'title' => 'New department',
                    'message' => "{$admin->full_name} added {$department->name} ({$department->code}) to {$company->name}.",
                ]));

            return $department->load('head:id,first_name,last_name');
        });
    }
}
