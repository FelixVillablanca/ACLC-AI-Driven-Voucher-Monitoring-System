<?php

namespace Tests\Feature\Api;

use App\Models\Company;
use App\Models\Department;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * GET /api/v1/admin/dashboard (Framer Nhw7N27tM, admin landing page).
 * Since 2026-11-20 an Admin runs ONE company: every number is for that company only.
 *
 * Run:  php artisan test --filter=AdminDashboardTest
 */
class AdminDashboardTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_gets_the_numbers_for_their_own_company_only(): void
    {
        $apex = Company::factory()->create(['name' => 'Apex']);
        $north = Company::factory()->create(['name' => 'Northfield']);
        $admin = User::factory()->admin()->create(['company_id' => $apex->id]);

        Department::factory()->for($apex)->create(['head_user_id' => $admin->id]);
        Department::factory()->for($apex)->create();   // no head
        Department::factory()->for($north)->create();  // another company: not counted

        // Apex has no payee types; Northfield has some (but isn't this Admin's business)
        DB::table('payee_types')->insert(['name' => 'Supplier', 'company_id' => $north->id]);

        $clerk = User::factory()->create(['company_id' => $apex->id]);
        $clerk->accessibleCompanies()->attach($apex->id, ['granted_status' => 'accepted']);
        User::factory()->officer()->create(['company_id' => $apex->id]);      // Apex, but no access row yet
        User::factory()->officer()->create(['company_id' => $north->id]);     // another company
        User::factory()->superAdmin()->create(['company_id' => $apex->id]);   // never counted

        $this->actingAs($admin)
            ->getJson('/api/v1/admin/dashboard')
            ->assertOk()
            ->assertJsonPath('data.company', ['id' => $apex->id, 'name' => 'Apex', 'is_active' => true])
            ->assertJsonPath('data.companies', ['total' => 1, 'active' => 1, 'inactive' => 0])
            ->assertJsonPath('data.departments', ['total' => 2, 'without_head' => 1, 'companies' => 1])
            ->assertJsonPath('data.users.total', 2)               // clerk + Apex officer (= the Users page; never the Admin)
            ->assertJsonPath('data.users.never_signed_in', 2)
            ->assertJsonPath('data.company_access', ['total' => 1, 'users_without_access' => 1])
            ->assertJsonPath('data.needs_attention', [
                ['type' => 'users_without_access', 'count' => 1],
                ['type' => 'departments_without_head', 'count' => 1],
                ['type' => 'company_without_payee_types', 'company' => ['id' => $apex->id, 'name' => 'Apex']],
                ['type' => 'company_without_voucher_types'],
                ['type' => 'company_without_categories'],
            ])
            ->assertJsonPath('data.recent_activity', []);
    }

    public function test_recent_activity_lists_only_this_companys_audit_entries(): void
    {
        $apex = Company::factory()->create(['name' => 'Apex']);
        $north = Company::factory()->create(['name' => 'Northfield']);
        $admin = User::factory()->admin()->create(['first_name' => 'Felix', 'last_name' => 'V', 'company_id' => $apex->id]);

        DB::table('audit_logs')->insert([
            ['user_id' => $admin->id, 'company_id' => $apex->id, 'action' => 'created', 'table_name' => 'users',
                'record_id' => 99, 'new_values' => json_encode(['first_name' => 'Juan', 'last_name' => 'Dela Cruz']),
                'created_at' => now()->subMinutes(10)],
            ['user_id' => $admin->id, 'company_id' => $north->id, 'action' => 'created', 'table_name' => 'users',
                'record_id' => 100, 'new_values' => json_encode(['first_name' => 'Other', 'last_name' => 'Company']),
                'created_at' => now()->subMinutes(5)],
        ]);

        $this->actingAs($admin)
            ->getJson('/api/v1/admin/dashboard')
            ->assertOk()
            ->assertJsonCount(1, 'data.recent_activity')
            ->assertJsonPath('data.recent_activity.0.subject', 'Juan Dela Cruz')
            ->assertJsonPath('data.recent_activity.0.actor', 'Felix V')
            ->assertJsonPath('data.recent_activity.0.company', 'Apex');
    }

    public function test_an_admin_without_a_company_sees_nothing_from_other_companies(): void
    {
        Company::factory()->create();
        Department::factory()->create();
        $admin = User::factory()->admin()->create(['company_id' => null]);

        // since 2026-11-28: "No company yet" -> the console waits instead of showing an empty dashboard
        $this->actingAs($admin)
            ->getJson('/api/v1/admin/dashboard')
            ->assertForbidden()->assertJsonPath('code', 'NO_COMPANY_YET');
    }

    public function test_guests_get_401(): void
    {
        $this->getJson('/api/v1/admin/dashboard')
            ->assertUnauthorized()
            ->assertJsonPath('code', 'UNAUTHENTICATED');
    }

    public function test_non_admin_roles_get_403(): void
    {
        foreach (['accounting_clerk', 'accounting_officer', 'supervisor_manager'] as $role) {
            $this->actingAs(User::factory()->create(['role' => $role]))
                ->getJson('/api/v1/admin/dashboard')
                ->assertForbidden()
                ->assertJsonPath('code', 'FORBIDDEN');
        }
    }
}
