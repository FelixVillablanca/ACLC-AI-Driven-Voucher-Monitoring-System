<?php

namespace Tests\Feature\Api;

use App\Models\Company;
use App\Models\Department;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Admin dashboard Quick actions: "Add department" and "Grant company access".
 * Both only ever touch the Admin's own company.
 *
 * Run:  php artisan test --filter=AdminQuickActionsTest
 */
class AdminQuickActionsTest extends TestCase
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

    // ---------- Add department ----------

    public function test_admin_adds_a_department_to_their_own_company(): void
    {
        $other = User::factory()->admin()->create(['company_id' => $this->apex->id]);
        $head = User::factory()->supervisor()->create(['first_name' => 'Ana', 'last_name' => 'Cruz', 'company_id' => $this->apex->id]);

        $this->actingAs($this->admin)
            ->postJson('/api/v1/admin/departments', ['name' => '  Finance ', 'code' => 'fin', 'head_user_id' => $head->id, 'company_id' => $this->north->id])
            ->assertCreated()
            ->assertJsonPath('data.name', 'Finance')
            ->assertJsonPath('data.code', 'FIN')
            ->assertJsonPath('data.head.full_name', 'Ana Cruz');

        // a company sent from the browser is ignored
        $this->assertDatabaseHas('departments', ['name' => 'Finance', 'company_id' => $this->apex->id, 'head_user_id' => $head->id]);
        $this->assertDatabaseHas('audit_logs', ['action' => 'department_created', 'table_name' => 'departments', 'company_id' => $this->apex->id]);
        $this->assertDatabaseHas('notifications', ['recipient_id' => $other->id, 'type' => 'department_alert']);

        // it shows in the dashboard's Recent activity
        $this->actingAs($this->admin)->getJson('/api/v1/admin/dashboard')
            ->assertJsonPath('data.recent_activity.0.action', 'department_created')
            ->assertJsonPath('data.recent_activity.0.subject', 'Finance');
    }

    public function test_department_name_and_code_are_unique_inside_the_company_only(): void
    {
        Department::factory()->for($this->apex)->create(['name' => 'Finance', 'code' => 'FIN']);
        Department::factory()->for($this->north)->create(['name' => 'Operations', 'code' => 'OPS']);

        $this->actingAs($this->admin)
            ->postJson('/api/v1/admin/departments', ['name' => 'FINANCE', 'code' => 'FIN'])
            ->assertUnprocessable()
            ->assertJsonPath('errors.name.0', 'Your company already has a department with this name.')
            ->assertJsonPath('errors.code.0', 'Your company already uses this code.');

        // another company's name and code are fine
        $this->actingAs($this->admin)->postJson('/api/v1/admin/departments', ['name' => 'Operations', 'code' => 'OPS'])->assertCreated();
    }

    public function test_department_head_must_be_an_active_person_of_the_company(): void
    {
        $outsider = User::factory()->supervisor()->create(['company_id' => $this->north->id]);
        $inactive = User::factory()->supervisor()->inactive()->create(['company_id' => $this->apex->id]);

        foreach ([$outsider->id, $inactive->id, $this->admin->id, 999999] as $id) {
            $this->actingAs($this->admin)
                ->postJson('/api/v1/admin/departments', ['name' => 'HR', 'code' => 'HR', 'head_user_id' => $id])
                ->assertUnprocessable()
                ->assertJsonPath('errors.head_user_id.0', 'Choose an active person from your company.');
        }
    }

    public function test_bad_department_fields_are_422(): void
    {
        $this->actingAs($this->admin)
            ->postJson('/api/v1/admin/departments', ['name' => '', 'code' => 'fin ance!'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['name', 'code']);
    }

    public function test_people_lookup_lists_only_the_companys_operational_users(): void
    {
        User::factory()->create(['first_name' => 'Maria', 'company_id' => $this->apex->id]);
        User::factory()->create(['first_name' => 'Nora', 'company_id' => $this->north->id]);

        $this->actingAs($this->admin)->getJson('/api/v1/admin/lookups/people')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.role', 'accounting_clerk');
    }

    // ---------- Grant company access ----------

    public function test_candidates_are_this_companys_active_users_without_accepted_access(): void
    {
        $none = User::factory()->create(['first_name' => 'Ana', 'company_id' => $this->apex->id]);
        $denied = User::factory()->officer()->create(['first_name' => 'Ben', 'company_id' => $this->apex->id]);
        $denied->accessibleCompanies()->attach($this->apex->id, ['granted_status' => 'denied']);
        $ok = User::factory()->create(['first_name' => 'Cara', 'company_id' => $this->apex->id]);
        $ok->accessibleCompanies()->attach($this->apex->id, ['granted_status' => 'accepted']);
        User::factory()->inactive()->create(['first_name' => 'Dan', 'company_id' => $this->apex->id]);
        User::factory()->create(['first_name' => 'Eve', 'company_id' => $this->north->id]);

        $this->actingAs($this->admin)->getJson('/api/v1/admin/company-access/candidates')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.id', $none->id)
            ->assertJsonPath('data.0.access', 'none')
            ->assertJsonPath('data.1.access', 'denied')
            ->assertJsonPath('meta.total', 2)
            ->assertJsonPath('meta.company.name', 'Apex');

        $this->actingAs($this->admin)->getJson('/api/v1/admin/company-access/candidates?search=ben')
            ->assertJsonCount(1, 'data');
    }

    public function test_admin_grants_access_and_the_dashboard_count_drops(): void
    {
        $ana = User::factory()->create(['first_name' => 'Ana', 'last_name' => 'Reyes', 'company_id' => $this->apex->id]);
        $ben = User::factory()->officer()->create(['company_id' => $this->apex->id]);
        $ben->accessibleCompanies()->attach($this->apex->id, ['granted_status' => 'pending']);

        $this->actingAs($this->admin)->getJson('/api/v1/admin/dashboard')->assertJsonPath('data.company_access.users_without_access', 2);

        $this->actingAs($this->admin)
            ->postJson('/api/v1/admin/company-access', ['user_ids' => [$ana->id, $ben->id]])
            ->assertOk()
            ->assertJsonPath('meta.granted', 2);

        $this->assertSame(1, DB::table('user_company_access')->where('user_id', $ben->id)->count()); // pending row updated, not duplicated
        $this->assertDatabaseHas('user_company_access', ['user_id' => $ana->id, 'company_id' => $this->apex->id, 'granted_status' => 'accepted', 'granted_by' => $this->admin->id]);
        $this->assertSame(2, DB::table('audit_logs')->where('action', 'access_granted')->count());

        $this->actingAs($this->admin)->getJson('/api/v1/admin/dashboard')
            ->assertJsonPath('data.company_access.users_without_access', 0)
            ->assertJsonPath('data.recent_activity.1.subject', 'Ana Reyes');
    }

    public function test_granting_someone_who_already_has_access_or_is_in_another_company_is_409(): void
    {
        $outsider = User::factory()->create(['company_id' => $this->north->id]);
        $ok = User::factory()->create(['company_id' => $this->apex->id]);
        $ok->accessibleCompanies()->attach($this->apex->id, ['granted_status' => 'accepted']);
        $fresh = User::factory()->create(['company_id' => $this->apex->id]);

        foreach ([$outsider->id, $ok->id] as $id) {
            $this->actingAs($this->admin)
                ->postJson('/api/v1/admin/company-access', ['user_ids' => [$fresh->id, $id]])
                ->assertStatus(409)
                ->assertJsonPath('code', 'ACCESS_LIST_CHANGED');
        }

        // all or nothing: the valid person wasn't granted either
        $this->assertDatabaseMissing('user_company_access', ['user_id' => $fresh->id]);
        $this->assertDatabaseMissing('user_company_access', ['user_id' => $outsider->id, 'company_id' => $this->apex->id]);
    }

    public function test_empty_selection_is_422(): void
    {
        $this->actingAs($this->admin)->postJson('/api/v1/admin/company-access', ['user_ids' => []])
            ->assertUnprocessable()
            ->assertJsonPath('errors.user_ids.0', 'Choose at least one person.');
    }

    // ---------- shared ----------

    public function test_admin_without_a_company_gets_403(): void
    {
        $loose = User::factory()->admin()->create(['company_id' => null]);

        $this->actingAs($loose)->postJson('/api/v1/admin/departments', ['name' => 'HR', 'code' => 'HR'])
            ->assertForbidden()->assertJsonPath('code', 'NO_ACTIVE_COMPANY');
        $this->actingAs($loose)->postJson('/api/v1/admin/company-access', ['user_ids' => [1]])
            ->assertForbidden()->assertJsonPath('code', 'NO_ACTIVE_COMPANY');
    }

    public function test_guests_are_401_and_other_roles_403(): void
    {
        $this->postJson('/api/v1/admin/departments', [])->assertUnauthorized();
        $this->getJson('/api/v1/admin/company-access/candidates')->assertUnauthorized();

        $clerk = User::factory()->create(['company_id' => $this->apex->id]);
        $clerk->accessibleCompanies()->attach($this->apex->id, ['granted_status' => 'accepted']);
        $this->actingAs($clerk)->postJson('/api/v1/admin/departments', ['name' => 'HR', 'code' => 'HR'])->assertForbidden();
        $this->actingAs($clerk)->postJson('/api/v1/admin/company-access', ['user_ids' => [$clerk->id]])->assertForbidden();
    }
}
