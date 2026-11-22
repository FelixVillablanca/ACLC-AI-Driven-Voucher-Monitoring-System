<?php

namespace Tests\Feature\Api;

use App\Models\Company;
use App\Models\Department;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

/**
 * People & Access → Users (list, filters, side panel, edit incl. role change, deactivate / reactivate,
 * set a new password). Only the Admin's own company's clerks / officers / supervisors.
 *
 * Run:  php artisan test --filter=AdminUsersPageTest
 */
class AdminUsersPageTest extends TestCase
{
    use RefreshDatabase;

    private const URL = '/api/v1/admin/users';

    private Company $apex;

    private Company $north;

    private User $admin;

    private Department $finance;

    private User $maria;

    private User $jose;

    private User $outsider;

    protected function setUp(): void
    {
        parent::setUp();
        $this->apex = Company::factory()->create(['name' => 'Apex']);
        $this->north = Company::factory()->create(['name' => 'Northfield']);
        $this->admin = User::factory()->admin()->create(['first_name' => 'John', 'company_id' => $this->apex->id, 'last_login_at' => now()]);
        $this->finance = Department::factory()->for($this->apex)->create(['name' => 'Finance', 'code' => 'FIN']);

        $this->maria = User::factory()->create([
            'first_name' => 'Maria', 'last_name' => 'Lopez', 'email' => 'marialopez@Clerk.com',
            'company_id' => $this->apex->id, 'department_id' => $this->finance->id, 'last_login_at' => now(),
        ]);
        $this->jose = User::factory()->officer()->create([
            'first_name' => 'Jose', 'last_name' => 'Ramos', 'company_id' => $this->apex->id, 'last_login_at' => null,
        ]);
        User::factory()->supervisor()->inactive()->create(['first_name' => 'Zed', 'company_id' => $this->apex->id]);
        $this->outsider = User::factory()->create(['first_name' => 'Nora', 'company_id' => $this->north->id]);
        User::factory()->superAdmin()->create(['company_id' => $this->apex->id]);
    }

    public function test_lists_only_the_companys_operational_users_with_summary(): void
    {
        $this->actingAs($this->admin)->getJson(self::URL)
            ->assertOk()
            ->assertJsonCount(3, 'data') // Maria, Jose, Zed (not the Admin, the Super Admin or Nora)
            ->assertJsonPath('data.0.full_name', 'Jose Ramos')
            ->assertJsonPath('data.0.status', 'pending')
            ->assertJsonPath('data.1.department.name', 'Finance')
            ->assertJsonPath('meta.views', ['all' => 3, 'active' => 1, 'pending' => 1, 'inactive' => 1])
            ->assertJsonPath('meta.summary.total', 3)
            ->assertJsonPath('meta.summary.without_department', 1)
            ->assertJsonPath('meta.summary.by_role.accounting_clerk', 1)
            ->assertJsonMissingPath('data.0.password');
    }

    public function test_filters_search_and_sort(): void
    {
        $get = fn (string $q) => $this->actingAs($this->admin)->getJson(self::URL.$q);

        $get('?filter[view]=pending')->assertJsonCount(1, 'data')->assertJsonPath('data.0.first_name', 'Jose');
        $get('?filter[role]=accounting_clerk')->assertJsonCount(1, 'data');
        $get("?filter[department]={$this->finance->id}")->assertJsonCount(1, 'data')->assertJsonPath('data.0.first_name', 'Maria');
        $get('?filter[department]=none')->assertJsonCount(2, 'data');
        $get('?search=lopez')->assertJsonCount(1, 'data');
        $get('?search=nora')->assertJsonCount(0, 'data'); // another company
        $get('?sort=name_desc')->assertJsonPath('data.0.first_name', 'Zed');
        $get('?filter[role]=admin')->assertUnprocessable();
    }

    public function test_another_companys_user_the_admin_and_super_admins_are_404(): void
    {
        foreach ([$this->outsider->id, $this->admin->id] as $id) {
            $this->actingAs($this->admin)->getJson(self::URL."/{$id}")->assertNotFound();
            $this->actingAs($this->admin)->patchJson(self::URL."/{$id}", ['first_name' => 'X', 'last_name' => 'Y', 'role' => 'accounting_clerk'])->assertNotFound();
            $this->actingAs($this->admin)->postJson(self::URL."/{$id}/deactivate")->assertNotFound();
            $this->actingAs($this->admin)->postJson(self::URL."/{$id}/password", ['password' => 'abcdefgh1234'])->assertNotFound();
        }
        $this->assertDatabaseHas('users', ['id' => $this->outsider->id, 'first_name' => 'Nora', 'is_active' => true]);
    }

    public function test_edit_name_and_department(): void
    {
        $this->actingAs($this->admin)
            ->patchJson(self::URL."/{$this->jose->id}", [
                'first_name' => 'Joseph', 'last_name' => 'Ramos', 'role' => 'accounting_officer',
                'department_id' => $this->finance->id, 'updated_at' => $this->jose->updated_at->toIso8601String(),
            ])
            ->assertOk()
            ->assertJsonPath('data.first_name', 'Joseph')
            ->assertJsonPath('data.department.code', 'FIN')
            ->assertJsonPath('meta.changed', ['first_name', 'department_id'])
            ->assertJsonPath('meta.signed_out', false);

        $this->assertDatabaseHas('audit_logs', ['action' => 'updated', 'table_name' => 'users', 'record_id' => $this->jose->id]);
    }

    public function test_role_change_moves_the_email_domain_and_signs_them_out(): void
    {
        DB::table('sessions')->insert(['id' => 'abc', 'user_id' => $this->maria->id, 'payload' => '', 'last_activity' => time()]);

        $this->actingAs($this->admin)
            ->patchJson(self::URL."/{$this->maria->id}", ['first_name' => 'Maria', 'last_name' => 'Lopez', 'role' => 'accounting_officer', 'department_id' => $this->finance->id])
            ->assertOk()
            ->assertJsonPath('data.email', 'marialopez@Officer.com')
            ->assertJsonPath('meta.signed_out', true);

        $this->assertDatabaseMissing('sessions', ['user_id' => $this->maria->id]);
        $row = DB::table('audit_logs')->where('action', 'role_changed')->first();
        $this->assertSame('marialopez@Clerk.com', json_decode($row->old_values, true)['email']);
    }

    public function test_role_change_is_refused_when_the_new_email_is_taken(): void
    {
        User::factory()->officer()->create(['email' => 'marialopez@Officer.com', 'company_id' => $this->north->id]);

        $this->actingAs($this->admin)
            ->patchJson(self::URL."/{$this->maria->id}", ['first_name' => 'Maria', 'last_name' => 'Lopez', 'role' => 'accounting_officer'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['role']);
        $this->assertDatabaseHas('users', ['id' => $this->maria->id, 'role' => 'accounting_clerk']);
    }

    public function test_stale_edit_is_409_and_bad_fields_are_422(): void
    {
        $this->actingAs($this->admin)
            ->patchJson(self::URL."/{$this->maria->id}", ['first_name' => 'M', 'last_name' => 'L', 'role' => 'accounting_clerk', 'updated_at' => '2020-01-01T00:00:00+08:00'])
            ->assertStatus(409)->assertJsonPath('code', 'USER_CHANGED');

        $other = Department::factory()->for($this->north)->create();
        $inactive = Department::factory()->for($this->apex)->create(['is_active' => false]);
        foreach ([$other->id, $inactive->id] as $dept) {
            $this->actingAs($this->admin)
                ->patchJson(self::URL."/{$this->jose->id}", ['first_name' => 'Jose', 'last_name' => 'Ramos', 'role' => 'admin', 'department_id' => $dept])
                ->assertUnprocessable()
                ->assertJsonValidationErrors(['role', 'department_id']);
        }
    }

    public function test_a_user_may_stay_in_their_department_after_it_was_deactivated(): void
    {
        $this->finance->forceFill(['is_active' => false])->save();

        $this->actingAs($this->admin)
            ->patchJson(self::URL."/{$this->maria->id}", ['first_name' => 'Maria', 'last_name' => 'Lopez-Cruz', 'role' => 'accounting_clerk', 'department_id' => $this->finance->id])
            ->assertOk();
    }

    public function test_deactivate_signs_out_and_reactivate_brings_back(): void
    {
        DB::table('sessions')->insert(['id' => 'xyz', 'user_id' => $this->maria->id, 'payload' => '', 'last_activity' => time()]);

        $this->actingAs($this->admin)->postJson(self::URL."/{$this->maria->id}/deactivate", ['reason' => 'Left the company'])
            ->assertOk()->assertJsonPath('data.status', 'inactive');
        $this->assertDatabaseMissing('sessions', ['user_id' => $this->maria->id]);
        $this->assertDatabaseHas('audit_logs', ['action' => 'account_deactivated', 'record_id' => $this->maria->id, 'company_id' => $this->apex->id]);

        $this->actingAs($this->admin)->postJson(self::URL."/{$this->maria->id}/deactivate")->assertStatus(409)->assertJsonPath('code', 'USER_ALREADY_INACTIVE');
        $this->actingAs($this->admin)->postJson(self::URL."/{$this->maria->id}/password", ['password' => 'abcdefgh1234'])
            ->assertStatus(409)->assertJsonPath('code', 'USER_INACTIVE');

        $this->actingAs($this->admin)->postJson(self::URL."/{$this->maria->id}/reactivate")->assertOk()->assertJsonPath('data.status', 'active');
    }

    public function test_set_a_new_password(): void
    {
        $this->actingAs($this->admin)->postJson(self::URL."/{$this->maria->id}/password", ['password' => 'short1'])->assertUnprocessable();

        $this->actingAs($this->admin)->postJson(self::URL."/{$this->maria->id}/password", ['password' => 'NewPassword2026'])->assertOk();
        $this->assertTrue(Hash::check('NewPassword2026', $this->maria->fresh()->password));

        $row = DB::table('audit_logs')->where('action', 'password_set_by_admin')->first();
        $this->assertStringNotContainsString('NewPassword2026', (string) $row->new_values);
    }

    public function test_guests_are_401_and_other_roles_403(): void
    {
        $this->getJson(self::URL)->assertUnauthorized();
        $this->maria->accessibleCompanies()->attach($this->apex->id, ['granted_status' => 'accepted']);
        $this->actingAs($this->maria)->getJson(self::URL)->assertForbidden();
        $this->actingAs($this->maria)->postJson(self::URL."/{$this->jose->id}/deactivate")->assertForbidden();
    }
}
