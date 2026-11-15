<?php

namespace Database\Seeders;

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
 *   - 'role' must be one of: admin, accounting_clerk, accounting_officer, supervisor_manager
 *   - 'company' and 'access' use company NAMES that already exist
 *     (DemoDataSeeder creates "Apex Holdings Inc." and "Northfield Academy")
 *   - 'department' is a department CODE in the home company: ACC, HR or OPS
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
     * ("Domain emails"): {user}@administrator.com, @clerk.com, @officer.com, @supervisor.com.
     * All use the password: password
     */
    private array $users = [
        [
            'email' => 'johndoe@administrator.com',
            'password' => 'password',
            'first_name' => 'John',
            'last_name' => 'Doe',
            'employee_id' => 'EMP-20001',
            'role' => 'admin',
            'company' => 'Apex Holdings Inc.',
            'department' => null, // admins sit outside the voucher workflow
            'access' => [],       // admins don't switch companies
        ],
        [
            'email' => 'marialopez@clerk.com',
            'password' => 'password',
            'first_name' => 'Maria',
            'last_name' => 'Lopez',
            'employee_id' => 'EMP-20002',
            'role' => 'accounting_clerk',
            'company' => 'Apex Holdings Inc.',
            'department' => 'ACC',
            'access' => ['Apex Holdings Inc.', 'Northfield Academy'],
        ],
        [
            'email' => 'joseramos@officer.com',
            'password' => 'password',
            'first_name' => 'Jose',
            'last_name' => 'Ramos',
            'employee_id' => 'EMP-20003',
            'role' => 'accounting_officer',
            'company' => 'Apex Holdings Inc.',
            'department' => 'ACC',
            'access' => ['Apex Holdings Inc.', 'Northfield Academy'],
        ],
        [
            'email' => 'anamendoza@supervisor.com',
            'password' => 'password',
            'first_name' => 'Ana',
            'last_name' => 'Mendoza',
            'employee_id' => 'EMP-20004',
            'role' => 'supervisor_manager',
            'company' => 'Apex Holdings Inc.',
            'department' => 'ACC',
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
                $company = $this->company($row['company']);
                $department = $company->departments()->where('code', $row['department'])->first();

                if ($row['department'] && ! $department) {
                    throw new RuntimeException("Department [{$row['department']}] not found in [{$company->name}].");
                }

                $user = User::firstOrCreate(['email' => $row['email']], [
                    'password' => $row['password'], // hashed automatically by the User model
                    'first_name' => $row['first_name'],
                    'last_name' => $row['last_name'],
                    'employee_id' => $row['employee_id'],
                    'role' => $row['role'],
                    'is_active' => true,
                    'access_status' => 'accepted',
                    'company_id' => $company->id,
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
