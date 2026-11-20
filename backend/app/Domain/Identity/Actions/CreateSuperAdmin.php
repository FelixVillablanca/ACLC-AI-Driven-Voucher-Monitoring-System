<?php

namespace App\Domain\Identity\Actions;

use App\Domain\Identity\Support\EmployeeIdGenerator;
use App\Domain\Identity\Support\RoleEmailDomains;
use App\Domain\Reporting\Queries\SuperAdminDashboardSummary;
use App\Domain\Security\Actions\RaiseSecurityAlert;
use App\Exceptions\ApiException;
use App\Models\SecurityAlert;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Creates a Super Admin account (spec §4.2). Used by `php artisan superadmin:create`,
 * never by a web page, so nobody on the internet can make themselves the platform owner.
 *
 * In ONE transaction:
 *   1. lock the existing Super Admin rows and check the seat limit (max 3).
 *      The LOCK stops two terminals from both taking "the last seat" at the same moment.
 *   2. create the user (email built by the server: {name}@Superadmin.com)
 *   3. write an audit-log row (user_id NULL = done by the system console, company_id NULL = platform-level)
 *   4. raise a (low) security alert + tell the other Super Admins, because a new platform owner is a sensitive change
 */
class CreateSuperAdmin
{
    public function __construct(private EmployeeIdGenerator $employeeIds, private RaiseSecurityAlert $raise) {}

    public function handle(string $firstName, string $lastName, string $username, string $password): User
    {
        return DB::transaction(function () use ($firstName, $lastName, $username, $password) {
            $existing = User::where('role', 'super_admin')->where('is_active', true)->lockForUpdate()->get(['id']);

            if ($existing->count() >= SuperAdminDashboardSummary::SUPER_ADMIN_SEATS) {
                throw new ApiException(
                    'All '.SuperAdminDashboardSummary::SUPER_ADMIN_SEATS.' Super Admin seats are taken. Deactivate one first.',
                    'SUPER_ADMIN_SEATS_FULL',
                    409,
                );
            }

            $user = User::create([
                'employee_id' => $this->employeeIds->next(),
                'first_name' => $firstName,
                'last_name' => $lastName,
                'email' => RoleEmailDomains::emailFor($username, 'super_admin'),
                'password' => $password, // hashed by the User model
                'role' => 'super_admin',
                'company_id' => null,
                'department_id' => null,
                'is_active' => true,
                'access_status' => 'accepted',
                'last_login_at' => null,
            ]);

            DB::table('audit_logs')->insert([
                'user_id' => null,
                'company_id' => null,
                'action' => 'created',
                'table_name' => 'users',
                'record_id' => $user->id,
                'old_values' => null,
                'new_values' => json_encode([
                    'employee_id' => $user->employee_id,
                    'first_name' => $user->first_name,
                    'last_name' => $user->last_name,
                    'email' => $user->email,
                    'role' => 'super_admin',
                    'via' => 'console: superadmin:create',
                ]),
                'ip_address' => null,
                'user_agent' => null,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            $this->raise->handle([
                'type' => SecurityAlert::TYPE_SUPER_ADMIN_ADDED,
                'severity' => 'low',
                'user_id' => $user->id,
                'subject_email' => strtolower($user->email),
                'details' => ['via' => 'console: superadmin:create'],
            ], 'New Super Admin added', "{$user->full_name} ({$user->email}) was made a Super Admin from the server console.", [$user->id]);

            return $user;
        });
    }
}
