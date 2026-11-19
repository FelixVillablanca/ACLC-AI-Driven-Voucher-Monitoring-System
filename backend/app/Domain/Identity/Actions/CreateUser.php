<?php

namespace App\Domain\Identity\Actions;

use App\Domain\Identity\Support\EmployeeIdGenerator;
use App\Models\Company;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Creates a user account from the admin's "Create user" form (Framer lmhV2DJV1).
 *
 * In ONE transaction ("all or nothing"):
 *   1. the next Employee ID (EMP-2026-0001…), locked so nobody else gets it
 *   2. the user row (the password from the form is stored HASHED)
 *   3. their company access rows (user_company_access)
 *   4. an audit-log entry, which shows up in the dashboard's "Recent activity"
 *   5. a "New user account created" notification for the OTHER admins
 */
class CreateUser
{
    private const ROLE_LABELS = [
        'admin' => 'Administrator',
        'accounting_clerk' => 'Accounting Clerk',
        'accounting_officer' => 'Accounting Officer',
        'supervisor_manager' => 'Supervisor / Manager',
    ];

    public function __construct(private EmployeeIdGenerator $employeeIds) {}

    /** @param  array<string, mixed>  $data  validated StoreUserRequest data */
    public function handle(array $data, User $admin, ?string $ip = null, ?string $userAgent = null): User
    {
        // If two admins somehow still collide on the same Employee ID, the UNIQUE index
        // refuses the second one; we simply try again with the next number (max 3 times).
        return retry(3, fn () => DB::transaction(fn () => $this->create($data, $admin, $ip, $userAgent)), 50,
            fn ($e) => $e instanceof UniqueConstraintViolationException && str_contains($e->getMessage(), 'employee_id'));
    }

    private function create(array $data, User $admin, ?string $ip, ?string $userAgent): User
    {
        $isAdminRole = $data['role'] === 'admin';

        $user = User::create([
            'employee_id' => $this->employeeIds->next(),
            'first_name' => $data['first_name'],
            'last_name' => $data['last_name'],
            'email' => $data['email'],
            'password' => $data['password'], // hashed by the User model
            'role' => $data['role'],
            'company_id' => $data['company_id'],
            'department_id' => $data['department_id'] ?? null,
            'is_active' => true,
            'access_status' => 'accepted',
            'last_login_at' => null, // never signed in yet
        ]);

        if (! $isAdminRole) {
            $user->accessibleCompanies()->attach(
                collect($data['company_ids'])->unique()->mapWithKeys(fn ($id) => [
                    $id => ['granted_status' => 'accepted', 'granted_by' => $admin->id, 'granted_at' => now()],
                ])->all()
            );
        }

        DB::table('audit_logs')->insert([
            'user_id' => $admin->id,
            'company_id' => $data['company_id'],
            'action' => 'created',
            'table_name' => 'users',
            'record_id' => $user->id,
            'old_values' => null,
            'new_values' => json_encode([
                'employee_id' => $user->employee_id,
                'first_name' => $user->first_name,
                'last_name' => $user->last_name,
                'email' => $user->email,
                'role' => $user->role,
                'company_ids' => $isAdminRole ? [] : array_values(array_unique($data['company_ids'])),
            ]),
            'ip_address' => $ip,
            'user_agent' => $userAgent ? Str::limit($userAgent, 500, '') : null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $companyName = Company::whereKey($data['company_id'])->value('name');
        User::where('role', 'admin')->whereKeyNot($admin->id)->pluck('id')->each(fn ($adminId) => Notification::create([
            'recipient_id' => $adminId,
            'type' => 'user_changed',
            'title' => 'New user account created',
            'message' => "{$user->full_name} (".self::ROLE_LABELS[$user->role].") was added to {$companyName}.",
        ]));

        return $user;
    }
}
