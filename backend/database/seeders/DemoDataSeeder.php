<?php

namespace Database\Seeders;

use App\Models\Company;
use App\Models\Department;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * DEMO DATA: sample companies, departments and one login per role.
 *
 * All demo logins use the password:  password
 *   admin@advms.test       (admin)
 *   clerk@advms.test       (accounting_clerk)
 *   officer@advms.test     (accounting_officer)
 *   supervisor@advms.test  (supervisor_manager)
 *
 * SAFE TO RUN TWICE: it uses firstOrCreate ("find it, or create it if
 * missing"), so running it again does NOT make duplicates.
 * It only ADDS data. It never deletes anything.
 */
class DemoDataSeeder extends Seeder
{
    public function run(): void
    {
        // Safety: demo logins with password "password" must never reach the live server
        if (app()->environment('production')) {
            throw new RuntimeException('DemoDataSeeder must not run in production.');
        }

        // A transaction = "all or nothing". If any step fails, nothing is saved.
        DB::transaction(function () {
            // 1) Companies first (the "school")
            $apex = Company::firstOrCreate(['name' => 'Apex Holdings Inc.'], [
                'type' => 'corporate',
                'address' => 'Makati City, Metro Manila',
                'contact_email' => 'finance@apexholdings.test',
                'is_active' => true,
            ]);
            $northfield = Company::firstOrCreate(['name' => 'Northfield Academy'], [
                'type' => 'school',
                'address' => 'Quezon City, Metro Manila',
                'contact_email' => 'accounting@northfield.test',
                'is_active' => true,
            ]);

            // 2) Departments next (the "classrooms"), the same 3 for each company
            foreach ([$apex, $northfield] as $company) {
                foreach ([['Accounting', 'ACC'], ['Human Resources', 'HR'], ['Operations', 'OPS']] as [$name, $code]) {
                    Department::firstOrCreate(
                        ['company_id' => $company->id, 'code' => $code],
                        ['name' => $name, 'is_active' => true],
                    );
                }
            }
            $apexAccounting = $apex->departments()->where('code', 'ACC')->first();

            // 3) Users last (the "students"), one per role
            $admin = $this->demoUser('admin@advms.test', 'admin', 'System', 'Admin', 'EMP-00001', $apex->id, null);
            $clerk = $this->demoUser('clerk@advms.test', 'accounting_clerk', 'Carla', 'Reyes', 'EMP-00002', $apex->id, $apexAccounting->id);
            $officer = $this->demoUser('officer@advms.test', 'accounting_officer', 'Oscar', 'Santos', 'EMP-00003', $apex->id, $apexAccounting->id);
            $supervisor = $this->demoUser('supervisor@advms.test', 'supervisor_manager', 'Sofia', 'Garcia', 'EMP-00004', $apex->id, $apexAccounting->id);

            // 4) Company access: the 3 operational users may switch between both companies.
            //    syncWithoutDetaching = "add these links if missing, keep any existing ones".
            foreach ([$clerk, $officer, $supervisor] as $user) {
                $user->accessibleCompanies()->syncWithoutDetaching([
                    $apex->id => ['granted_status' => 'accepted', 'granted_by' => $admin->id],
                    $northfield->id => ['granted_status' => 'accepted', 'granted_by' => $admin->id],
                ]);
            }
        });
    }

    private function demoUser(string $email, string $role, string $first, string $last, string $employeeId, int $companyId, ?int $departmentId): User
    {
        return User::firstOrCreate(['email' => $email], [
            'employee_id' => $employeeId,
            'first_name' => $first,
            'last_name' => $last,
            'password' => 'password', // the User model hashes (scrambles) it automatically
            'role' => $role,
            'is_active' => true,
            'access_status' => 'accepted',
            'company_id' => $companyId,
            'department_id' => $departmentId,
        ]);
    }
}
