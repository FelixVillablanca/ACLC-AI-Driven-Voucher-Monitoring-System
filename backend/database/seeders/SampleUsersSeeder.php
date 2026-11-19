<?php

namespace Database\Seeders;

use App\Domain\Identity\Support\EmployeeIdGenerator;
use App\Models\Company;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * YOUR OWN SAMPLE USERS. Add a row to $users below, then run:
 *
 *   php artisan db:seed --class=SampleUsersSeeder --env=testing
 *
 * Rules:
 *   - 'role' must be one of: super_admin, admin, accounting_clerk, accounting_officer, supervisor_manager
 *   - 'company' and 'access' use company NAMES that already exist
 *     (DemoDataSeeder creates "Apex Holdings Inc." and "Northfield Academy").
 *     'company' may be null for a Super Admin, who works outside every company.
 *   - 'department' is a department CODE in the home company, or null (none exist yet)
 *   - the Employee ID is assigned automatically (EMP-2026-0001…)
 *   - 'access' = the companies the user may switch between (leave [] for admins)
 *
 * SAFE TO RUN AGAIN: a user whose email already exists is skipped, not duplicated.
 * Full guide: docs/SAMPLE_DATA_GUIDE.md
 */
class SampleUsersSeeder extends Seeder
{
    /** @var array<int, array<string, mixed>> */
    /*
     * One user per role, following the email-domain convention in CLAUDE.md
     * ("Domain emails"): {user}@Superadmin.com, @Administrator.com, @Clerk.com, @Officer.com, @Supervisor.com.
     * All use the password: password
     */
    private array $users = [
        [
            // Super Admin (docs/System_Flow_Roles_and_UML_Design.docx §4). Needs migration 2026_11_19_000001.
            'email' => 'felixbianito@Superadmin.com',
            'password' => 'password',
            'first_name' => 'Felix',
            'last_name' => 'Bianito',
            'role' => 'super_admin',
            'company' => null,    // works outside the company/voucher flow
            'department' => null,
            'access' => [],       // no company access needed
        ],
        [
            'email' => 'johndoe@Administrator.com',
            'password' => 'password',
            'first_name' => 'John',
            'last_name' => 'Doe',
            'role' => 'admin',
            'company' => 'Apex Holdings Inc.',
            'department' => null, // admins sit outside the voucher workflow
            'access' => [],       // admins don't switch companies
        ],
        [
            'email' => 'marialopez@Clerk.com',
            'password' => 'password',
            'first_name' => 'Maria',
            'last_name' => 'Lopez',
            'role' => 'accounting_clerk',
            'company' => 'Apex Holdings Inc.',
            'department' => null,
            'access' => ['Apex Holdings Inc.', 'Northfield Academy'],
        ],
        [
            'email' => 'joseramos@Officer.com',
            'password' => 'password',
            'first_name' => 'Jose',
            'last_name' => 'Ramos',
            'role' => 'accounting_officer',
            'company' => 'Apex Holdings Inc.',
            'department' => null,
            'access' => ['Apex Holdings Inc.', 'Northfield Academy'],
        ],
        [
            'email' => 'anamendoza@Supervisor.com',
            'password' => 'password',
            'first_name' => 'Ana',
            'last_name' => 'Mendoza',
            'role' => 'supervisor_manager',
            'company' => 'Apex Holdings Inc.',
            'department' => null,
            'access' => ['Apex Holdings Inc.', 'Northfield Academy'],
        ],
        // Copy a block above to add more users.
    ];

    public function run(): void
    {
        if (app()->environment('production')) {
            throw new RuntimeException('SampleUsersSeeder must not run in production.');
        }

        DB::transaction(function () {
            $admin = User::where('role', 'admin')->first(); // recorded as "granted_by"

            foreach ($this->users as $row) {
                $company = $row['company'] ? $this->company($row['company']) : null;
                $department = $row['department'] ? $company?->departments()->where('code', $row['department'])->first() : null;

                if ($row['department'] && ! $department) {
                    throw new RuntimeException("Department [{$row['department']}] not found in [".($company->name ?? 'no company').'].');
                }

                $user = User::where('email', $row['email'])->first() ?? User::create([
                    'email' => $row['email'],
                    'password' => $row['password'], // hashed automatically by the User model
                    'first_name' => $row['first_name'],
                    'last_name' => $row['last_name'],
                    'employee_id' => app(EmployeeIdGenerator::class)->next(), // EMP-2026-0001…
                    'role' => $row['role'],
                    'is_active' => true,
                    'access_status' => 'accepted',
                    'company_id' => $company?->id,
                    'department_id' => $department?->id,
                ]);

                $access = collect($row['access'])->mapWithKeys(fn (string $name) => [
                    $this->company($name)->id => ['granted_status' => 'accepted', 'granted_by' => $admin?->id],
                ]);
                $user->accessibleCompanies()->syncWithoutDetaching($access->all());

                $this->command?->info("  {$user->email} ({$user->role}) ready");
            }
        });
    }

    private function company(string $name): Company
    {
        return Company::where('name', $name)->first()
            ?? throw new RuntimeException("Company [{$name}] not found. Run DemoDataSeeder first, or fix the name.");
    }
}
