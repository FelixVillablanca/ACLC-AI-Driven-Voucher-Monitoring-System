<?php

namespace Tests\Feature\Api;

use App\Models\Company;
use App\Models\Department;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Organization → Departments (list, search, views, sort, side panel, edit, deactivate / reactivate).
 * Always the Admin's own company; another company's department is 404.
 *
 * Run:  php artisan test --filter=AdminDepartmentsTest
 */
class AdminDepartmentsTest extends TestCase
{
    use RefreshDatabase;

    private const URL = '/api/v1/admin/departments';

    private Company $apex;

    private Company $north;

    private User $admin;

    private Department $finance;

    private Department $hr;

    private Department $northOps;

    protected function setUp(): void
    {
        parent::setUp();
        $this->apex = Company::factory()->create(['name' => 'Apex']);
        $this->north = Company::factory()->create(['name' => 'Northfield']);
        $this->admin = User::factory()->admin()->create(['company_id' => $this->apex->id]);

        $head = User::factory()->supervisor()->create(['first_name' => 'Ana', 'last_name' => 'Cruz', 'company_id' => $this->apex->id]);
        $this->finance = Department::factory()->for($this->apex)->create(['name' => 'Finance', 'code' => 'FIN', 'head_user_id' => $head->id]);
        $this->hr = Department::factory()->for($this->apex)->create(['name' => 'Human Resources', 'code' => 'HR', 'head_user_id' => null]);
        $this->northOps = Department::factory()->for($this->north)->create(['name' => 'Operations', 'code' => 'OPS']);

        User::factory()->count(2)->create(['company_id' => $this->apex->id, 'department_id' => $this->finance->id]);
        $head->forceFill(['department_id' => $this->finance->id])->save();
        User::factory()->create(['company_id' => $this->apex->id, 'department_id' => null]); // no department
    }

    public function test_lists_only_the_admins_company_with_counts_and_summary(): void
    {
        $this->actingAs($this->admin)->getJson(self::URL)
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.name', 'Finance')
            ->assertJsonPath('data.0.people_count', 3)
            ->assertJsonPath('data.0.head.full_name', 'Ana Cruz')
            ->assertJsonPath('data.1.head', null)
            ->assertJsonPath('meta.views', ['all' => 2, 'active' => 2, 'inactive' => 0, 'no_head' => 1])
            ->assertJsonPath('meta.summary', ['total' => 2, 'active' => 2, 'without_head' => 1, 'people_without_department' => 1]);
    }

    public function test_search_views_and_sort(): void
    {
        $this->actingAs($this->admin)->getJson(self::URL.'?search=ana')->assertJsonCount(1, 'data')->assertJsonPath('data.0.code', 'FIN'); // head's name
        $this->actingAs($this->admin)->getJson(self::URL.'?search=hr')->assertJsonCount(1, 'data');
        $this->actingAs($this->admin)->getJson(self::URL.'?search=ops')->assertJsonCount(0, 'data'); // other company
        $this->actingAs($this->admin)->getJson(self::URL.'?filter[view]=no_head')->assertJsonCount(1, 'data')->assertJsonPath('data.0.code', 'HR');
        $this->actingAs($this->admin)->getJson(self::URL.'?sort=name_desc')->assertJsonPath('data.0.code', 'HR');
        $this->actingAs($this->admin)->getJson(self::URL.'?filter[view]=bogus')->assertUnprocessable();
    }

    public function test_side_panel_shows_the_department_and_its_people(): void
    {
        $this->actingAs($this->admin)->getJson(self::URL."/{$this->finance->id}")->assertOk()->assertJsonPath('data.people_count', 3);
        $this->actingAs($this->admin)->getJson(self::URL."/{$this->finance->id}/members")
            ->assertOk()
            ->assertJsonCount(3, 'data')
            ->assertJsonPath('meta.head_user_id', $this->finance->head_user_id);
    }

    public function test_another_companys_department_is_404_everywhere(): void
    {
        $id = $this->northOps->id;
        $this->actingAs($this->admin)->getJson(self::URL."/{$id}")->assertNotFound();
        $this->actingAs($this->admin)->getJson(self::URL."/{$id}/members")->assertNotFound();
        $this->actingAs($this->admin)->patchJson(self::URL."/{$id}", ['name' => 'Mine', 'code' => 'MINE'])->assertNotFound();
        $this->actingAs($this->admin)->postJson(self::URL."/{$id}/deactivate")->assertNotFound();
        $this->assertDatabaseHas('departments', ['id' => $id, 'name' => 'Operations', 'is_active' => true]);
    }

    public function test_edit_saves_only_the_changes_and_audits_them(): void
    {
        $this->actingAs($this->admin)
            ->patchJson(self::URL."/{$this->hr->id}", [
                'name' => 'People & Culture', 'code' => 'hr', 'description' => null, 'head_user_id' => null,
                'updated_at' => $this->hr->updated_at->toIso8601String(),
            ])
            ->assertOk()
            ->assertJsonPath('data.name', 'People & Culture')
            ->assertJsonPath('meta.changed', ['name']);

        $row = DB::table('audit_logs')->where('action', 'department_updated')->first();
        $this->assertSame(['name' => 'Human Resources'], json_decode($row->old_values, true));
    }

    public function test_edit_keeps_its_own_name_but_refuses_a_siblings(): void
    {
        $this->actingAs($this->admin)
            ->patchJson(self::URL."/{$this->hr->id}", ['name' => 'Human Resources', 'code' => 'FIN'])
            ->assertUnprocessable()
            ->assertJsonPath('errors.code.0', 'Your company already uses this code.')
            ->assertJsonMissingValidationErrors(['name']);
    }

    public function test_edit_with_a_stale_form_is_409(): void
    {
        $this->actingAs($this->admin)
            ->patchJson(self::URL."/{$this->hr->id}", ['name' => 'HR team', 'code' => 'HR', 'updated_at' => '2020-01-01T00:00:00+08:00'])
            ->assertStatus(409)
            ->assertJsonPath('code', 'DEPARTMENT_CHANGED');
        $this->assertDatabaseHas('departments', ['id' => $this->hr->id, 'name' => 'Human Resources']);
    }

    public function test_the_current_head_may_stay_even_if_deactivated_but_a_new_inactive_head_is_refused(): void
    {
        $head = User::find($this->finance->head_user_id);
        $head->forceFill(['is_active' => false])->save();

        $this->actingAs($this->admin)
            ->patchJson(self::URL."/{$this->finance->id}", ['name' => 'Finance & Accounting', 'code' => 'FIN', 'head_user_id' => $head->id])
            ->assertOk();

        $other = User::factory()->supervisor()->inactive()->create(['company_id' => $this->apex->id]);
        $this->actingAs($this->admin)
            ->patchJson(self::URL."/{$this->finance->id}", ['name' => 'Finance & Accounting', 'code' => 'FIN', 'head_user_id' => $other->id])
            ->assertUnprocessable()
            ->assertJsonPath('errors.head_user_id.0', 'Choose an active person from your company.');
    }

    public function test_deactivate_and_reactivate(): void
    {
        $this->actingAs($this->admin)->postJson(self::URL."/{$this->finance->id}/deactivate", ['reason' => 'Merged into Accounting'])
            ->assertOk()
            ->assertJsonPath('data.is_active', false);

        $this->assertDatabaseHas('audit_logs', ['action' => 'department_deactivated', 'record_id' => $this->finance->id]);
        $this->assertSame(3, User::where('department_id', $this->finance->id)->count()); // people stay
        $this->actingAs($this->admin)->getJson('/api/v1/admin/lookups/companies')->assertJsonCount(1, 'data.0.departments'); // hidden for new users

        $this->actingAs($this->admin)->postJson(self::URL."/{$this->finance->id}/deactivate")
            ->assertStatus(409)->assertJsonPath('code', 'DEPARTMENT_ALREADY_INACTIVE');

        $this->actingAs($this->admin)->postJson(self::URL."/{$this->finance->id}/reactivate")
            ->assertOk()->assertJsonPath('data.is_active', true);
        $this->actingAs($this->admin)->postJson(self::URL."/{$this->finance->id}/reactivate")
            ->assertStatus(409)->assertJsonPath('code', 'DEPARTMENT_ALREADY_ACTIVE');
    }

    public function test_guests_are_401_and_other_roles_403(): void
    {
        $this->getJson(self::URL)->assertUnauthorized();
        $this->patchJson(self::URL."/{$this->hr->id}", [])->assertUnauthorized();

        $clerk = User::factory()->create(['company_id' => $this->apex->id]);
        $clerk->accessibleCompanies()->attach($this->apex->id, ['granted_status' => 'accepted']);
        $this->actingAs($clerk)->getJson(self::URL)->assertForbidden();
        $this->actingAs($clerk)->postJson(self::URL."/{$this->hr->id}/deactivate")->assertForbidden();
    }
}
