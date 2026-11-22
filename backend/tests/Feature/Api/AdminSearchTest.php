<?php

namespace Tests\Feature\Api;

use App\Models\Company;
use App\Models\Department;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * GET /api/v1/admin/search (the Admin top-bar search).
 * An Admin runs ONE company, so the search only sees that company's users and departments.
 *
 * Run:  php artisan test --filter=AdminSearchTest
 */
class AdminSearchTest extends TestCase
{
    use RefreshDatabase;

    private Company $apex;

    private Company $north;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->apex = Company::factory()->create(['name' => 'Apex']);
        $this->north = Company::factory()->create(['name' => 'Northfield']);
        $this->admin = User::factory()->admin()->create(['first_name' => 'John', 'last_name' => 'Doe', 'company_id' => $this->apex->id]);
    }

    public function test_finds_users_and_departments_of_the_admins_own_company(): void
    {
        $finance = Department::factory()->for($this->apex)->create(['name' => 'Finance', 'code' => 'FIN']);
        User::factory()->create(['first_name' => 'Liza', 'last_name' => 'Santos', 'company_id' => $this->apex->id, 'department_id' => $finance->id]);
        Department::factory()->for($this->apex)->create(['name' => 'Lizard Lab', 'code' => 'LZ']);

        $this->actingAs($this->admin)
            ->getJson('/api/v1/admin/search?q=liz')
            ->assertOk()
            ->assertJsonCount(1, 'data.users')
            ->assertJsonPath('data.users.0.full_name', 'Liza Santos')
            ->assertJsonPath('data.users.0.department', 'Finance')
            ->assertJsonCount(1, 'data.departments')
            ->assertJsonPath('data.departments.0.name', 'Lizard Lab')
            ->assertJsonPath('meta.company', ['id' => $this->apex->id, 'name' => 'Apex']);
    }

    public function test_never_shows_another_companys_users_departments_or_super_admins(): void
    {
        User::factory()->create(['first_name' => 'Maria', 'last_name' => 'North', 'company_id' => $this->north->id]);
        Department::factory()->for($this->north)->create(['name' => 'Maria Dept', 'code' => 'MD']);
        User::factory()->superAdmin()->create(['first_name' => 'Maria', 'last_name' => 'Owner', 'company_id' => $this->apex->id]);

        $this->actingAs($this->admin)
            ->getJson('/api/v1/admin/search?q=maria')
            ->assertOk()
            ->assertJsonPath('data.users', [])
            ->assertJsonPath('data.departments', []);
    }

    public function test_a_user_given_access_to_the_admins_company_is_found(): void
    {
        $guest = User::factory()->create(['first_name' => 'Carlo', 'company_id' => $this->north->id]);
        $guest->accessibleCompanies()->attach($this->apex->id, ['granted_status' => 'accepted']);

        $this->actingAs($this->admin)
            ->getJson('/api/v1/admin/search?q=carlo')
            ->assertOk()
            ->assertJsonCount(1, 'data.users');
    }

    public function test_full_name_email_and_employee_id_match_and_wildcards_are_literal(): void
    {
        User::factory()->create(['first_name' => 'Ana', 'last_name' => 'Mendoza', 'employee_id' => 'EMP-2026-0042', 'company_id' => $this->apex->id]);

        $this->actingAs($this->admin)->getJson('/api/v1/admin/search?q=ana mendoza')->assertJsonCount(1, 'data.users');
        $this->actingAs($this->admin)->getJson('/api/v1/admin/search?q=0042')->assertJsonCount(1, 'data.users');
        // "%%" would match everyone if it were used as a LIKE wildcard
        $this->actingAs($this->admin)->getJson('/api/v1/admin/search?q=%25%25')->assertJsonPath('data.users', []);
    }

    public function test_admin_without_a_company_gets_empty_results(): void
    {
        $loose = User::factory()->admin()->create(['company_id' => null]);
        User::factory()->create(['first_name' => 'Liza', 'company_id' => $this->apex->id]);

        $this->actingAs($loose)
            ->getJson('/api/v1/admin/search?q=liza')
            ->assertOk()
            ->assertJsonPath('data.users', [])
            ->assertJsonPath('meta.company', null);
    }

    public function test_too_short_query_is_422(): void
    {
        $this->actingAs($this->admin)
            ->getJson('/api/v1/admin/search?q=a')
            ->assertStatus(422)
            ->assertJsonValidationErrors('q');
    }

    public function test_guest_is_401(): void
    {
        $this->getJson('/api/v1/admin/search?q=liza')->assertUnauthorized();
    }

    public function test_non_admins_are_403(): void
    {
        $clerk = User::factory()->create(['company_id' => $this->apex->id]);
        $clerk->accessibleCompanies()->attach($this->apex->id, ['granted_status' => 'accepted']);

        $this->actingAs($clerk)->getJson('/api/v1/admin/search?q=liza')->assertForbidden();
        $this->actingAs(User::factory()->superAdmin()->create())->getJson('/api/v1/admin/search?q=liza')->assertForbidden();
    }
}
