<?php

namespace App\Domain\Tenancy\Actions;

use App\Domain\Audit\AuditTrail;
use App\Domain\Tenancy\Support\AdminCompany;
use App\Exceptions\ApiException;
use App\Models\Department;
use App\Models\User;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;

/**
 * "Edit department" on the Departments page.
 *
 * OPTIMISTIC CONCURRENCY: the form sends the `updated_at` it was opened with. If someone saved
 * the department in the meantime, nothing is changed and the answer is 409 DEPARTMENT_CHANGED
 * (the screen then reloads it), so one Admin can't silently overwrite another's edit.
 * Only the fields that really changed are saved and written to the audit log.
 */
class UpdateDepartment
{
    private const FIELDS = ['name', 'code', 'description', 'head_user_id'];

    /** @return array{department: Department, changed: list<string>} */
    public function handle(Department $department, array $data, ?string $openedAt, User $admin, ?string $ip = null): array
    {
        AdminCompany::activeFor($admin, 'department changes');

        return DB::transaction(function () use ($department, $data, $openedAt, $admin, $ip) {
            /** @var Department $department */
            $department = Department::whereKey($department->id)->lockForUpdate()->firstOrFail();

            if ($openedAt !== null && $department->updated_at?->toIso8601String() !== $openedAt) {
                throw new ApiException(
                    "Someone else changed {$department->name} while you were editing. Its latest details are loaded now; check them and save again.",
                    'DEPARTMENT_CHANGED',
                    409,
                );
            }

            $old = [];
            $new = [];
            foreach (self::FIELDS as $field) {
                $value = $data[$field] ?? null;
                if ($department->{$field} != $value) {
                    $old[$field] = $department->{$field};
                    $new[$field] = $value;
                }
            }

            if ($new === []) {
                return ['department' => $department, 'changed' => []];
            }

            try {
                $department->forceFill($new)->save();
            } catch (UniqueConstraintViolationException) {
                throw new ApiException('Another department already uses this name or code.', 'DEPARTMENT_CONFLICT', 409);
            }

            // a new head joins the department (2026-11-28: the head is always one of its members)
            if (array_key_exists('head_user_id', $new)) {
                app(ManageDepartmentPeople::class)->placeHeadInto($department, $new['head_user_id'], $admin, $ip);
            }

            AuditTrail::record([
                'user_id' => $admin->id,
                'company_id' => $department->company_id,
                'action' => 'department_updated',
                'table_name' => 'departments',
                'record_id' => $department->id,
                'old_values' => $old,
                'new_values' => ['name' => $department->name, ...$new],
                'ip_address' => $ip,
            ]);

            return ['department' => $department, 'changed' => array_keys($new)];
        });
    }
}
