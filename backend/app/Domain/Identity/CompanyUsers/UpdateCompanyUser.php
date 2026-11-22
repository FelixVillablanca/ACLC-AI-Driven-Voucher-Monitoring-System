<?php

namespace App\Domain\Identity\CompanyUsers;

use App\Domain\Audit\AuditTrail;
use App\Domain\Identity\Support\RoleEmailDomains;
use App\Domain\Security\Support\OwnerActivity;
use App\Domain\Tenancy\Support\AdminCompany;
use App\Exceptions\ApiException;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * "Edit user" on the Users page: first / last name, role, department.
 *
 * ROLE CHANGE: the sign-in email follows the role (maria@Clerk.com → maria@Officer.com,
 * RoleEmailDomains), so it changes too, and the person is signed out everywhere: their next
 * sign-in uses the new email and opens the new role's page.
 *
 * OPTIMISTIC CONCURRENCY: `updated_at` from when the form opened; 409 USER_CHANGED if someone
 * saved this person meanwhile. Only real changes are saved and audited.
 */
class UpdateCompanyUser
{
    /** @return array{user: User, changed: list<string>, signed_out: bool} */
    public function handle(User $target, array $data, ?string $openedAt, User $admin, ?string $ip = null): array
    {
        AdminCompany::activeFor($admin, 'user changes');

        return DB::transaction(function () use ($target, $data, $openedAt, $admin, $ip) {
            /** @var User $target */
            $target = User::whereKey($target->id)->lockForUpdate()->firstOrFail();

            if ($openedAt !== null && $target->updated_at?->toIso8601String() !== $openedAt) {
                throw new ApiException(
                    "Someone else changed {$target->full_name} while you were editing. Their latest details are loaded now; check them and save again.",
                    'USER_CHANGED',
                    409,
                );
            }

            $new = [];
            foreach (['first_name', 'last_name', 'role', 'department_id'] as $field) {
                $value = $data[$field] ?? null;
                if ($target->{$field} != $value) {
                    $new[$field] = $value;
                }
            }

            $roleChanged = isset($new['role']);
            if ($roleChanged) {
                $email = RoleEmailDomains::emailFor(strstr($target->email, '@', true) ?: $target->email, $new['role']);
                if (User::where('email', $email)->whereKeyNot($target->id)->exists()) {
                    throw ValidationException::withMessages(['role' => "Someone already uses {$email}, so this role can't be given with the same email name."]);
                }
                $new['email'] = $email;
            }

            if ($new === []) {
                return ['user' => $target, 'changed' => [], 'signed_out' => false];
            }

            $old = array_intersect_key($target->only(array_keys($new)), $new);
            $target->forceFill($new)->save();

            if ($roleChanged) {
                OwnerActivity::signOutEverywhere($target);
            }

            AuditTrail::record([
                'user_id' => $admin->id,
                'company_id' => $target->company_id,
                'action' => $roleChanged ? 'role_changed' : 'updated',
                'table_name' => 'users',
                'record_id' => $target->id,
                'old_values' => $old,
                'new_values' => ['first_name' => $target->first_name, 'last_name' => $target->last_name, ...$new],
                'ip_address' => $ip,
            ]);

            return ['user' => $target, 'changed' => array_keys($new), 'signed_out' => $roleChanged];
        });
    }
}
