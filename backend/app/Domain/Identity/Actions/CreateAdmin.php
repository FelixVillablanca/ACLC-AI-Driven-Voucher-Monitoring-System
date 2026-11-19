<?php

namespace App\Domain\Identity\Actions;

use App\Domain\Identity\Support\EmployeeIdGenerator;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * A Super Admin creates an Admin account (Framer TkIHF89oH, spec §4.3 / §4.8).
 * Only Super Admins may do this. Since 2026-11-20 each Admin runs exactly ONE company,
 * and gets a "set your password" link at their personal email instead of a typed password.
 *
 * In ONE transaction:
 *   1. the next Employee ID (locked, so two Super Admins can't get the same one)
 *   2. the Admin: their company, personal email, status "pending" (until they set a password),
 *      and a long random password nobody knows (so the account can't be used before that)
 *   3. an audit-log row for that company, with the IP address
 *   4. a "user_changed" notification for every OTHER active Super Admin
 * AFTER the transaction: the invitation email (a mail problem must not undo the account).
 */
class CreateAdmin
{
    public function __construct(
        private EmployeeIdGenerator $employeeIds,
        private SendAccountInvitation $invitation,
    ) {}

    /**
     * @param  array{first_name: string, last_name: string, email: string, personal_email: string, company_id: int}  $data
     * @return array{admin: User, invitation_sent: bool}
     */
    public function handle(array $data, User $superAdmin, ?string $ip = null, ?string $userAgent = null): array
    {
        // Same safety net as CreateUser: retry if two saves collide on an Employee ID
        $admin = retry(3, fn () => DB::transaction(fn () => $this->create($data, $superAdmin, $ip, $userAgent)), 50,
            fn ($e) => $e instanceof UniqueConstraintViolationException && str_contains($e->getMessage(), 'employee_id'));

        return ['admin' => $admin, 'invitation_sent' => $this->invitation->handle($admin, $superAdmin, $ip)];
    }

    private function create(array $data, User $superAdmin, ?string $ip, ?string $userAgent): User
    {
        $admin = User::create([
            'employee_id' => $this->employeeIds->next(),
            'first_name' => $data['first_name'],
            'last_name' => $data['last_name'],
            'email' => $data['email'],
            'personal_email' => $data['personal_email'],
            'password' => Str::password(40), // unknown to everyone; replaced when they use the link
            'role' => 'admin',
            'company_id' => $data['company_id'],
            'department_id' => null,
            'is_active' => true,
            'access_status' => 'pending', // becomes "accepted" when they set their password
            'last_login_at' => null, // "Pending" until their first sign-in
        ]);

        DB::table('audit_logs')->insert([
            'user_id' => $superAdmin->id,
            'company_id' => $admin->company_id,
            'action' => 'created',
            'table_name' => 'users',
            'record_id' => $admin->id,
            'old_values' => null,
            'new_values' => json_encode([
                'employee_id' => $admin->employee_id,
                'first_name' => $admin->first_name,
                'last_name' => $admin->last_name,
                'email' => $admin->email,
                'role' => 'admin',
                'company_id' => $admin->company_id,
                'personal_email' => $admin->personal_email,
            ]),
            'ip_address' => $ip,
            'user_agent' => $userAgent ? Str::limit($userAgent, 500, '') : null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        User::where('role', 'super_admin')->where('is_active', true)->whereKeyNot($superAdmin->id)->pluck('id')
            ->each(fn ($id) => Notification::create([
                'recipient_id' => $id,
                'type' => 'user_changed',
                'title' => 'Admin account created',
                'message' => "{$admin->full_name} ({$admin->email}) was made Admin of {$admin->company->name} by {$superAdmin->full_name}.",
            ]));

        return $admin;
    }
}
