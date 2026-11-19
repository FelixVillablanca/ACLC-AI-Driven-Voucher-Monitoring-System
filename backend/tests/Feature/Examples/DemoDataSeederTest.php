<?php

namespace Tests\Feature\Examples;

use App\Models\User;
use Database\Seeders\DemoDataSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * LEARNING FILE: using a SEEDER inside a test.
 * $this->seed(...) runs the seeder on the TESTING database, then we check the result.
 *
 * Run:  php artisan test --filter=DemoDataSeederTest
 */
class DemoDataSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_creates_companies_and_one_user_per_role_but_no_departments(): void
    {
        $this->seed(DemoDataSeeder::class);

        $this->assertDatabaseCount('companies', 2);
        $this->assertDatabaseCount('departments', 0);   // the admin creates departments (2026-11-16)
        $this->assertDatabaseCount('users', 4);
        $this->assertDatabaseHas('users', ['email' => 'clerk@advms.test', 'role' => 'accounting_clerk']);
        $this->assertDatabaseHas('users', ['email' => 'admin@advms.test', 'role' => 'admin']);
    }

    public function test_demo_users_get_auto_generated_employee_ids(): void
    {
        $this->seed(DemoDataSeeder::class);

        $year = now()->year;
        $this->assertSame(
            ["EMP-{$year}-0001", "EMP-{$year}-0002", "EMP-{$year}-0003", "EMP-{$year}-0004"],
            User::orderBy('id')->pluck('employee_id')->all(),
        );
    }

    public function test_the_clerk_can_switch_between_both_companies(): void
    {
        $this->seed(DemoDataSeeder::class);

        $clerk = User::where('email', 'clerk@advms.test')->first();

        $this->assertCount(2, $clerk->accessibleCompanies);
        $this->assertSame('Apex Holdings Inc.', $clerk->company->name);
        $this->assertNull($clerk->department); // no department until the admin creates one
    }

    public function test_running_it_twice_does_not_make_duplicates(): void
    {
        $this->seed(DemoDataSeeder::class);
        $this->seed(DemoDataSeeder::class); // second time

        $this->assertDatabaseCount('users', 4);
        $this->assertDatabaseCount('user_company_access', 6); // 3 users x 2 companies
    }

    public function test_demo_password_works(): void
    {
        $this->seed(DemoDataSeeder::class);

        $officer = User::where('email', 'officer@advms.test')->first();
        $this->assertTrue(password_verify('password', $officer->password));
    }
}
