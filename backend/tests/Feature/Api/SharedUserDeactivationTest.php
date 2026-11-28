<?php

namespace Tests\Feature\Api;

use App\Models\Company;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Deactivating a clerk / officer / supervisor who also works in other companies (user decision 2026-11-28):
 * Deactivate stays "the whole account", but the home Admin sees which other companies they'd lose, can choose
 * "only remove them from your company" (Remove access) instead, and the other companies' Admins are told.
 *
 * Run:  php artisan test --filter=SharedUserDeactivationTest
 */
class SharedUserDeactivationTest extends TestCase
{
    use RefreshDatabase;

    private Company $apex;

    private Company $bayview;

    private User $apexAdmin;

    private User $bayAdmin;

    private User $maria;

    protected function setUp(): void
    {
        parent::setUp();
        $this->apex = Company::factory()->create(['name' => 'Apex']);
        $this->bayview = Company::factory()->create(['name' => 'Bayview']);
        $suspended = Company::factory()->create(['name' => 'Northfield', 'is_active' => false]);
        $suspended->forceFill(['suspended_at' => now()])->save();

        $this->apexAdmin = User::factory()->admin()->create(['first_name' => 'John', 'company_id' => $this->apex->id]);
        $this->bayAdmin = User::factory()->admin()->create(['first_name' => 'Liza', 'company_id' => $this->bayview->id]);

        // Maria's home company is Apex; she also joined Bayview (and a suspended company, which doesn't count)
        $this->maria = User::factory()->create(['first_name' => 'Maria', 'last_name' => 'Lopez', 'company_id' => $this->apex->id]);
        $this->maria->accessibleCompanies()->attach([
            $this->apex->id => ['granted_status' => 'accepted'],
            $this->bayview->id => ['granted_status' => 'accepted'],
            $suspended->id => ['granted_status' => 'accepted'],
        ]);
    }

    public function test_the_dialog_learns_which_other_companies_she_would_lose(): void
    {
        $this->actingAs($this->apexAdmin)->getJson("/api/v1/admin/users/{$this->maria->id}/other-companies")
            ->assertOk()
            ->assertJsonPath('data', [['id' => $this->bayview->id, 'name' => 'Bayview']])
            ->assertJsonPath('meta.home_access', true);

        // another company's Admin can't look at Apex's people
        $this->actingAs($this->bayAdmin)->getJson("/api/v1/admin/users/{$this->maria->id}/other-companies")->assertNotFound();
    }

    public function test_deactivating_tells_the_other_companies_admins_and_so_does_reactivating(): void
    {
        $this->actingAs($this->apexAdmin)->postJson("/api/v1/admin/users/{$this->maria->id}/deactivate", ['reason' => 'Left'])->assertOk();

        $this->assertFalse((bool) $this->maria->fresh()->is_active);
        $this->assertDatabaseHas('notifications', ['recipient_id' => $this->bayAdmin->id, 'title' => 'Shared user deactivated']);
        $this->assertDatabaseMissing('notifications', ['recipient_id' => $this->apexAdmin->id, 'title' => 'Shared user deactivated']);

        $this->actingAs($this->apexAdmin)->postJson("/api/v1/admin/users/{$this->maria->id}/reactivate")->assertOk();
        $this->assertDatabaseHas('notifications', ['recipient_id' => $this->bayAdmin->id, 'title' => 'Shared user reactivated']);
    }

    public function test_only_removing_her_from_the_home_company_keeps_her_other_companies(): void
    {
        $this->actingAs($this->apexAdmin)->postJson("/api/v1/admin/company-access/{$this->maria->id}/revoke", ['reason' => 'Moved'])->assertOk();

        $this->assertTrue((bool) $this->maria->fresh()->is_active);
        // she still works in Bayview, but not in Apex any more
        $this->actingAs($this->maria->fresh())->withHeader('X-Company-ID', (string) $this->bayview->id)->getJson('/api/v1/clerk/dashboard')->assertOk();
        $this->actingAs($this->maria->fresh())->withHeader('X-Company-ID', (string) $this->apex->id)->getJson('/api/v1/clerk/dashboard')->assertForbidden();
        $this->assertDatabaseMissing('notifications', ['recipient_id' => $this->bayAdmin->id, 'title' => 'Shared user deactivated']);

        $this->actingAs($this->apexAdmin)->getJson("/api/v1/admin/users/{$this->maria->id}/other-companies")->assertJsonPath('meta.home_access', false);
    }
}
