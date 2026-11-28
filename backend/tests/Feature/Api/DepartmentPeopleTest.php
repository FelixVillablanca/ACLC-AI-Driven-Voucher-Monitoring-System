<?php

namespace Tests\Feature\Api;

use App\Models\Company;
use App\Models\Department;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * People in a department (Departments side panel, user request 2026-11-28): add as member or head, one head per
 * department, the head is always a member, only active users of the Admin's company, moving between departments.
 *
 * Run:  php artisan test --filter=DepartmentPeopleTest
 */
class DepartmentPeopleTest extends TestCase
{
    use RefreshDatabase;

    private const URL = '/api/v1/admin/departments';

    private Company $apex;

    private User $admin;

    private Department $finance;

    private Department $hr;

    private User $maria;

    private User $jose;

    protected function setUp(): void
    {
        parent::setUp();
        $this->apex = Company::factory()->create(['name' => 'Apex']);
        $this->admin = User::factory()->admin()->create(['company_id' => $this->apex->id]);
        $this->finance = Department::factory()->for($this->apex)->create(['name' => 'Finance', 'code' => 'FIN', 'head_user_id' => null]);
        $this->hr = Department::factory()->for($this->apex)->create(['name' => 'HR', 'code' => 'HR', 'head_user_id' => null]);
        $this->maria = User::factory()->create(['first_name' => 'Maria', 'last_name' => 'Lopez', 'company_id' => $this->apex->id, 'department_id' => null]);
        $this->jose = User::factory()->officer()->create(['first_name' => 'Jose', 'last_name' => 'Ramos', 'company_id' => $this->apex->id, 'department_id' => $this->hr->id]);
    }

    public function test_the_picker_lists_active_company_users_not_in_the_department(): void
    {
        $other = Company::factory()->create();
        User::factory()->create(['first_name' => 'Nora', 'company_id' => $other->id]);
        User::factory()->inactive()->create(['first_name' => 'Zed', 'company_id' => $this->apex->id]);
        User::factory()->create(['first_name' => 'Ana', 'company_id' => $this->apex->id, 'department_id' => $this->finance->id]);

        $res = $this->actingAs($this->admin)->getJson(self::URL."/{$this->finance->id}/candidates")->assertOk();

        $this->assertSame(['Jose Ramos', 'Maria Lopez'], collect($res->json('data'))->pluck('full_name')->all());
        $res->assertJsonPath('data.0.department.name', 'HR')->assertJsonPath('meta.company_users', 3);
    }

    public function test_add_members_and_a_head_moving_people_from_other_departments(): void
    {
        $this->hr->forceFill(['head_user_id' => $this->jose->id])->save();

        $this->actingAs($this->admin)
            ->postJson(self::URL."/{$this->finance->id}/people", ['user_ids' => [$this->maria->id, $this->jose->id], 'head_user_id' => $this->jose->id])
            ->assertOk()
            ->assertJsonPath('meta.added', 2)
            ->assertJsonPath('meta.moved', 1)
            ->assertJsonPath('meta.head', 'Jose Ramos');

        $this->assertSame($this->finance->id, $this->maria->fresh()->department_id);
        $this->assertSame($this->finance->id, $this->jose->fresh()->department_id);
        $this->assertSame($this->jose->id, $this->finance->fresh()->head_user_id);
        $this->assertNull($this->hr->fresh()->head_user_id); // he left HR, so HR has no head now
        $this->assertDatabaseHas('audit_logs', ['action' => 'department_members_added', 'record_id' => $this->finance->id]);
        $this->assertDatabaseHas('audit_logs', ['action' => 'department_head_changed', 'record_id' => $this->hr->id]);
    }

    public function test_one_head_only_replacing_needs_confirmation(): void
    {
        $this->actingAs($this->admin)->postJson(self::URL."/{$this->finance->id}/head", ['user_id' => $this->maria->id])->assertOk();
        $this->assertSame($this->finance->id, $this->maria->fresh()->department_id); // the head is always a member

        $this->actingAs($this->admin)->postJson(self::URL."/{$this->finance->id}/head", ['user_id' => $this->jose->id])
            ->assertStatus(409)->assertJsonPath('code', 'DEPARTMENT_HAS_HEAD');
        $this->assertSame($this->maria->id, $this->finance->fresh()->head_user_id);

        $this->actingAs($this->admin)->postJson(self::URL."/{$this->finance->id}/head", ['user_id' => $this->jose->id, 'replace_head' => true])->assertOk();
        $this->assertSame($this->jose->id, $this->finance->fresh()->head_user_id);
        $this->assertSame($this->finance->id, $this->maria->fresh()->department_id); // the old head stays a member

        $this->actingAs($this->admin)->deleteJson(self::URL."/{$this->finance->id}/head")->assertOk();
        $this->assertNull($this->finance->fresh()->head_user_id);
        $this->actingAs($this->admin)->deleteJson(self::URL."/{$this->finance->id}/head")->assertStatus(409);
    }

    public function test_removing_a_person_clears_their_department_and_head_slot(): void
    {
        $this->actingAs($this->admin)->postJson(self::URL."/{$this->hr->id}/head", ['user_id' => $this->jose->id])->assertOk();

        $this->actingAs($this->admin)->deleteJson(self::URL."/{$this->hr->id}/people/{$this->jose->id}")->assertOk();

        $this->assertNull($this->jose->fresh()->department_id);
        $this->assertNull($this->hr->fresh()->head_user_id);
        $this->actingAs($this->admin)->deleteJson(self::URL."/{$this->hr->id}/people/{$this->jose->id}")
            ->assertStatus(409)->assertJsonPath('code', 'NOT_A_MEMBER');
    }

    public function test_only_active_people_of_the_company_and_open_departments(): void
    {
        $outsider = User::factory()->create(['company_id' => Company::factory()->create()->id]);
        $inactive = User::factory()->inactive()->create(['company_id' => $this->apex->id]);

        foreach ([$outsider, $inactive, $this->admin] as $who) {
            $this->actingAs($this->admin)->postJson(self::URL."/{$this->finance->id}/people", ['user_ids' => [$who->id]])
                ->assertUnprocessable()->assertJsonValidationErrors(['user_ids']);
            $this->actingAs($this->admin)->postJson(self::URL."/{$this->finance->id}/head", ['user_id' => $who->id])->assertUnprocessable();
        }
        $this->actingAs($this->admin)->postJson(self::URL."/{$this->finance->id}/people", ['user_ids' => []])->assertUnprocessable();

        $this->finance->forceFill(['is_active' => false])->save();
        $this->actingAs($this->admin)->postJson(self::URL."/{$this->finance->id}/people", ['user_ids' => [$this->maria->id]])
            ->assertStatus(409)->assertJsonPath('code', 'DEPARTMENT_INACTIVE');

        // another company's department is invisible
        $theirs = Department::factory()->for(Company::factory()->create())->create();
        $this->actingAs($this->admin)->postJson(self::URL."/{$theirs->id}/people", ['user_ids' => [$this->maria->id]])->assertNotFound();
        $this->assertNull($this->maria->fresh()->department_id);
    }

    public function test_edit_department_head_joins_the_department_too(): void
    {
        $this->actingAs($this->admin)->patchJson(self::URL."/{$this->finance->id}", [
            'name' => 'Finance', 'code' => 'FIN', 'head_user_id' => $this->jose->id, 'updated_at' => $this->finance->updated_at->toIso8601String(),
        ])->assertOk();

        $this->assertSame($this->finance->id, $this->jose->fresh()->department_id);
    }
}
