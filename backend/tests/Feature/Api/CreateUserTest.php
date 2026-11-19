<?php

namespace Tests\Feature\Api;

use App\Models\Company;
use App\Models\Department;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

/**
 * POST /api/v1/admin/users, GET /api/v1/admin/users/next-employee-id,
 * GET /api/v1/admin/lookups/companies (Framer lmhV2DJV1, "Create user" modal).
 *
 * Run:  php artisan test --filter=CreateUserTest
 */
class CreateUserTest extends TestCase
{
    use RefreshDatabase;

    private const PASSWORD = 'Kp7m-Qx2r-Tw9n';

    private User $admin;

    private Company $apex;

    private Company $north;

    protected function setUp(): void
    {
        parent::setUp();
        $this->apex = Company::factory()->create(['name' => 'Apex Holdings']);
        $this->north = Company::factory()->create(['name' => 'Northwind Trading']);
        // Since 2026-11-20 an Admin runs ONE company (here: Apex)
        $this->admin = User::factory()->admin()->create(['employee_id' => null, 'company_id' => $this->apex->id]);
    }

    private function payload(array $overrides = []): array
    {
        return array_merge([
            'first_name' => 'Maria',
            'last_name' => 'Santos',
            'email_username' => 'Maria.Santos', // only the name; the server adds @Clerk.com
            'password' => self::PASSWORD,
            'role' => 'accounting_clerk',
            'company_id' => $this->apex->id,
            'department_id' => null,
            'company_ids' => [$this->apex->id],
        ], $overrides);
    }

    private function create(array $overrides = [])
    {
        return $this->actingAs($this->admin)->postJson('/api/v1/admin/users', $this->payload($overrides));
    }

    public function test_admin_creates_a_clerk_with_access_audit_and_notifications(): void
    {
        $otherAdmin = User::factory()->admin()->create(['employee_id' => null, 'company_id' => $this->apex->id]);
        $northAdmin = User::factory()->admin()->create(['employee_id' => null, 'company_id' => $this->north->id]);

        $this->create()
            ->assertCreated()
            ->assertJsonPath('data.email', 'maria.santos@Clerk.com') // name lower-cased, domain from the role
            ->assertJsonPath('data.employee_id', 'EMP-'.now()->year.'-0001')
            ->assertJsonPath('data.role', 'accounting_clerk')
            ->assertJsonPath('data.department', null)                   // department is optional
            ->assertJsonCount(1, 'data.companies')
            ->assertJsonMissingPath('meta.temporary_password');         // the admin already has it

        $user = User::where('email', 'maria.santos@Clerk.com')->firstOrFail();
        $this->assertTrue(Hash::check(self::PASSWORD, $user->password));
        $this->assertNotSame(self::PASSWORD, $user->password);           // stored hashed, never readable

        $this->assertDatabaseHas('user_company_access', ['user_id' => $user->id, 'company_id' => $this->apex->id, 'granted_status' => 'accepted']);
        $this->assertDatabaseHas('audit_logs', ['action' => 'created', 'table_name' => 'users', 'record_id' => $user->id]);
        $this->assertSame(1, Notification::for($otherAdmin)->where('type', 'user_changed')->count());
        $this->assertSame(0, Notification::for($this->admin)->count());
        $this->assertSame(0, Notification::for($northAdmin)->count()); // another company's Admin isn't told
    }

    public function test_employee_ids_count_up_and_the_client_cannot_choose_one(): void
    {
        $year = now()->year;

        $this->create(['employee_id' => 'HACKED-1'])->assertCreated()->assertJsonPath('data.employee_id', "EMP-{$year}-0001");
        $this->create(['email_username' => 'b.user'])->assertCreated()->assertJsonPath('data.employee_id', "EMP-{$year}-0002");

        // Numbers are compared as numbers, not text ("10000" comes after "9999")
        User::factory()->create(['employee_id' => "EMP-{$year}-9999"]);
        $this->create(['email_username' => 'c.user'])->assertCreated()->assertJsonPath('data.employee_id', "EMP-{$year}-10000");
    }

    public function test_next_employee_id_preview(): void
    {
        $year = now()->year;
        User::factory()->create(['employee_id' => "EMP-{$year}-0007"]);
        User::factory()->create(['employee_id' => 'EMP-2025-0400']); // last year's counter doesn't matter

        $this->actingAs($this->admin)
            ->getJson('/api/v1/admin/users/next-employee-id')
            ->assertOk()
            ->assertJsonPath('data.employee_id', "EMP-{$year}-0008");
    }

    public function test_the_database_refuses_duplicate_employee_ids(): void
    {
        User::factory()->create(['employee_id' => 'EMP-2026-0001']);

        $this->expectException(UniqueConstraintViolationException::class);
        User::factory()->create(['employee_id' => 'EMP-2026-0001']);
    }

    public function test_the_new_user_can_sign_in_with_the_generated_password(): void
    {
        $this->create()->assertCreated();
        auth()->guard('web')->logout();

        $this->withHeaders(['Origin' => 'http://localhost:5173', 'Referer' => 'http://localhost:5173/login'])
            ->postJson('/api/v1/auth/login', ['email' => 'maria.santos@clerk.com', 'password' => self::PASSWORD]) // any letter case works
            ->assertOk()
            ->assertJsonPath('data.role', 'accounting_clerk');
    }

    public function test_a_department_is_optional_but_must_belong_to_the_primary_company(): void
    {
        $apexFinance = Department::factory()->for($this->apex)->create(['name' => 'Finance', 'code' => 'FIN']);
        $northDept = Department::factory()->for($this->north)->create();

        $this->create(['department_id' => $northDept->id])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['department_id']);

        $this->create(['department_id' => $apexFinance->id])
            ->assertCreated()
            ->assertJsonPath('data.department.name', 'Finance');
    }

    public function test_weak_passwords_are_refused(): void
    {
        $this->create(['password' => 'short1'])->assertUnprocessable()
            ->assertJsonPath('errors.password.0', 'The password must be at least 12 characters.');

        $this->create(['password' => 'onlylettershere'])->assertUnprocessable()
            ->assertJsonPath('errors.password.0', 'The password must contain both letters and numbers.');
    }

    public function test_an_admin_cannot_create_admin_or_super_admin_accounts(): void
    {
        foreach (['admin', 'super_admin'] as $role) {
            $this->create(['role' => $role, 'company_ids' => [], 'email_username' => "jdoe.{$role}"])
                ->assertUnprocessable()
                ->assertJsonPath('errors.role.0', 'Choose Clerk, Officer or Supervisor. Admin accounts are created by a Super Admin.');
        }

        $this->assertSame(0, User::whereIn('role', ['super_admin'])->count());
        $this->assertSame(1, User::where('role', 'admin')->count()); // only the admin doing the test
    }

    public function test_required_fields_return_422(): void
    {
        $this->actingAs($this->admin)
            ->postJson('/api/v1/admin/users', [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['first_name', 'last_name', 'email_username', 'password', 'role', 'company_id']);
    }

    public function test_the_email_domain_always_comes_from_the_role(): void
    {
        $expected = [
            'accounting_clerk' => 'Clerk.com',
            'accounting_officer' => 'Officer.com',
            'supervisor_manager' => 'Supervisor.com',
        ];

        foreach ($expected as $role => $domain) {
            $this->create(['role' => $role, 'email_username' => "user.{$role}", 'email' => "evil@{$role}.hacker.com"])
                ->assertCreated()
                ->assertJsonPath('data.email', "user.{$role}@{$domain}"); // a sent 'email' is ignored
        }
    }

    public function test_the_email_name_cannot_contain_at_signs_or_spaces(): void
    {
        foreach (['maria@Admin.com', 'maria santos', '.maria', 'maria..santos'] as $bad) {
            $this->create(['email_username' => $bad])
                ->assertUnprocessable()
                ->assertJsonValidationErrors(['email_username']);
        }
    }

    public function test_duplicate_email_returns_422(): void
    {
        User::factory()->create(['email' => 'MARIA.SANTOS@clerk.com']); // same address, different letter case

        $this->create()->assertUnprocessable()
            ->assertJsonPath('errors.email_username.0', 'A user with this email already exists.');
    }

    public function test_an_admin_can_only_add_users_to_their_own_company(): void
    {
        $this->create(['company_id' => $this->north->id, 'company_ids' => [$this->north->id]])->assertUnprocessable()
            ->assertJsonPath('errors.company_id.0', 'You can only add users to your own company.');

        $this->create(['company_ids' => [$this->apex->id, $this->north->id]])->assertUnprocessable()
            ->assertJsonValidationErrors(['company_ids.1' => 'You can only give access to your own company.']);

        $this->create(['company_ids' => []])->assertUnprocessable()
            ->assertJsonValidationErrors(['company_ids']);
    }

    public function test_nothing_is_saved_when_validation_fails(): void
    {
        $before = User::count();
        $this->create(['role' => 'king'])->assertUnprocessable();
        $this->assertSame($before, User::count());
        $this->assertSame(0, DB::table('audit_logs')->count());
    }

    public function test_lookup_lists_only_the_admins_own_company_with_its_departments(): void
    {
        Department::factory()->for($this->apex)->create(['code' => 'FIN']);
        Department::factory()->for($this->north)->create(['code' => 'OPS']);

        $this->actingAs($this->admin)
            ->getJson('/api/v1/admin/lookups/companies')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.name', 'Apex Holdings')
            ->assertJsonCount(1, 'data.0.departments')
            ->assertJsonPath('data.0.departments.0.code', 'FIN');
    }

    public function test_guests_get_401_and_non_admins_get_403(): void
    {
        $this->postJson('/api/v1/admin/users', $this->payload())->assertUnauthorized();

        $this->actingAs(User::factory()->officer()->create())
            ->postJson('/api/v1/admin/users', $this->payload())
            ->assertForbidden();

        $this->actingAs(User::factory()->create())
            ->getJson('/api/v1/admin/users/next-employee-id')
            ->assertForbidden();
    }
}
