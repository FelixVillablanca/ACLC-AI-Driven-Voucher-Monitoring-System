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
 *
 * Run:  php artisan test --filter=AdminDashboardTest
 */
class AdminDashboardTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_gets_the_dashboard_numbers(): void
    {
        $admin = User::factory()->admin()->create();

        $apex = Company::factory()->create(['name' => 'Apex']);
        $north = Company::factory()->create(['name' => 'Northfield']);
        Company::factory()->create(['name' => 'Sunrise', 'is_active' => false]);

        Department::factory()->for($apex)->create(['head_user_id' => $admin->id]);
        Department::factory()->for($apex)->create();   // no head
        Department::factory()->for($north)->create();  // no head

        DB::table('payee_types')->insert(['name' => 'Supplier', 'company_id' => $apex->id]); // Northfield has none

        $clerk = User::factory()->create();             // accounting_clerk
        $clerk->accessibleCompanies()->attach($apex->id, ['granted_status' => 'accepted']);
        User::factory()->officer()->create();           // no access at all
        $pending = User::factory()->supervisor()->create();
        $pending->accessibleCompanies()->attach($north->id, ['granted_status' => 'pending']); // pending != access

        $this->actingAs($admin)
            ->getJson('/api/v1/admin/dashboard')
            ->assertOk()
            ->assertJsonPath('data.companies', ['total' => 3, 'active' => 2, 'inactive' => 1])
            ->assertJsonPath('data.departments', ['total' => 3, 'without_head' => 2, 'companies' => 2])
            ->assertJsonPath('data.users.total', 4)
            ->assertJsonPath('data.users.added_this_month', 4)
            ->assertJsonPath('data.company_access', ['total' => 1, 'users_without_access' => 2])
            ->assertJsonPath('data.needs_attention', [
                ['type' => 'users_without_access', 'count' => 2],
                ['type' => 'departments_without_head', 'count' => 2],
                ['type' => 'company_without_payee_types', 'company' => ['id' => $north->id, 'name' => 'Northfield']],
            ])
            ->assertJsonPath('data.recent_activity', []);
    }

    public function test_recent_activity_lists_the_newest_audit_entries(): void
    {
        $admin = User::factory()->admin()->create(['first_name' => 'Felix', 'last_name' => 'V']);
        $apex = Company::factory()->create(['name' => 'Apex']);

        DB::table('audit_logs')->insert([
            'user_id' => $admin->id, 'company_id' => $apex->id, 'action' => 'created', 'table_name' => 'users',
            'record_id' => 99, 'new_values' => json_encode(['first_name' => 'Juan', 'last_name' => 'Dela Cruz']),
            'created_at' => now()->subMinutes(10),
        ]);

        $this->actingAs($admin)
            ->getJson('/api/v1/admin/dashboard')
            ->assertOk()
            ->assertJsonPath('data.recent_activity.0.action', 'created')
            ->assertJsonPath('data.recent_activity.0.entity', 'users')
            ->assertJsonPath('data.recent_activity.0.subject', 'Juan Dela Cruz')
            ->assertJsonPath('data.recent_activity.0.actor', 'Felix V')
            ->assertJsonPath('data.recent_activity.0.company', 'Apex');
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
