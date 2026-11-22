<?php

namespace Tests\Feature\Api;

use App\Models\Company;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * People & Access → Company access page: everyone connected to the Admin's company with their
 * access status, and "Remove access". Only the Admin's own company.
 *
 * Run:  php artisan test --filter=AdminCompanyAccessPageTest
 */
class AdminCompanyAccessPageTest extends TestCase
{
    use RefreshDatabase;

    private const URL = '/api/v1/admin/company-access';

    private Company $apex;

    private Company $north;

    private User $admin;

    private User $ana;   // Apex, has access

    private User $ben;   // Apex, refused before

    private User $cara;  // Apex, no row

    private User $guest; // Northfield, has access to Apex

    protected function setUp(): void
    {
        parent::setUp();
        $this->apex = Company::factory()->create(['name' => 'Apex']);
        $this->north = Company::factory()->create(['name' => 'Northfield']);
        $this->admin = User::factory()->admin()->create(['first_name' => 'John', 'last_name' => 'Doe', 'company_id' => $this->apex->id]);

        $this->ana = User::factory()->create(['first_name' => 'Ana', 'company_id' => $this->apex->id]);
        $this->ana->accessibleCompanies()->attach($this->apex->id, ['granted_status' => 'accepted', 'granted_by' => $this->admin->id]);
        $this->ben = User::factory()->officer()->create(['first_name' => 'Ben', 'company_id' => $this->apex->id]);
        $this->ben->accessibleCompanies()->attach($this->apex->id, ['granted_status' => 'denied']);
        $this->cara = User::factory()->create(['first_name' => 'Cara', 'company_id' => $this->apex->id]);
        $this->guest = User::factory()->supervisor()->create(['first_name' => 'Gus', 'company_id' => $this->north->id]);
        $this->guest->accessibleCompanies()->attach($this->apex->id, ['granted_status' => 'accepted']);

        User::factory()->create(['first_name' => 'Nora', 'company_id' => $this->north->id]); // nothing to do with Apex
    }

    public function test_in_your_company_lists_your_own_people_with_their_access(): void
    {
        $this->actingAs($this->admin)->getJson(self::URL)
            ->assertOk()
            ->assertJsonCount(3, 'data') // Ana, Ben, Cara (not Gus from Northfield, not Nora, not the Admin)
            ->assertJsonPath('data.0.first_name', 'Ana')
            ->assertJsonPath('data.0.access', 'accepted')
            ->assertJsonPath('data.0.access_by', 'John Doe')
            ->assertJsonPath('data.1.access', 'denied')
            ->assertJsonPath('data.2.access', 'none')
            ->assertJsonPath('data.0.home_company', null)
            ->assertJsonPath('meta.views', ['in_company' => 3, 'other_companies' => 1, 'requests' => 0])
            ->assertJsonPath('meta.summary.can_be_granted', 2);
    }

    public function test_people_from_other_companies_show_work_email_and_role_only(): void
    {
        $this->actingAs($this->admin)->getJson(self::URL.'?filter[view]=other_companies')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.first_name', 'Gus')
            ->assertJsonPath('data.0.home_company.name', 'Northfield')
            ->assertJsonPath('data.0.email', $this->guest->email)
            ->assertJsonPath('data.0.employee_id', null)
            ->assertJsonPath('data.0.status', null)
            ->assertJsonPath('data.0.department', null);
    }

    public function test_access_filter_search_and_bad_filters(): void
    {
        $this->actingAs($this->admin)->getJson(self::URL.'?filter[access]=none')->assertJsonCount(2, 'data');
        $this->actingAs($this->admin)->getJson(self::URL.'?filter[access]=has')->assertJsonCount(1, 'data');
        $this->actingAs($this->admin)->getJson(self::URL.'?search=nora')->assertJsonCount(0, 'data');
        $this->actingAs($this->admin)->getJson(self::URL.'?search=ben')->assertJsonCount(1, 'data');
        // a guest's employee ID can't be searched (it belongs to their home company)
        $this->actingAs($this->admin)->getJson(self::URL.'?filter[view]=other_companies&search='.$this->guest->employee_id)->assertJsonCount(0, 'data');
        $this->actingAs($this->admin)->getJson(self::URL.'?filter[view]=everyone')->assertUnprocessable();
    }

    public function test_remove_access_keeps_the_row_as_denied_and_audits_it(): void
    {
        $this->actingAs($this->admin)->postJson(self::URL."/{$this->guest->id}/revoke", ['reason' => 'Project finished'])->assertOk();

        $this->assertDatabaseHas('user_company_access', ['user_id' => $this->guest->id, 'company_id' => $this->apex->id, 'granted_status' => 'denied', 'granted_by' => $this->admin->id]);
        $this->assertDatabaseHas('audit_logs', ['action' => 'access_revoked', 'company_id' => $this->apex->id]);

        // again = 409 (someone already removed it)
        $this->actingAs($this->admin)->postJson(self::URL."/{$this->guest->id}/revoke")
            ->assertStatus(409)->assertJsonPath('code', 'ACCESS_NOT_GRANTED');

        // the removed person can be granted again from the dialog (home-company people only)
        $this->actingAs($this->admin)->postJson(self::URL."/{$this->ana->id}/revoke")->assertOk();
        $this->actingAs($this->admin)->getJson(self::URL.'/candidates')->assertJsonFragment(['id' => $this->ana->id, 'access' => 'denied']);
    }

    public function test_remove_access_for_someone_without_a_row_or_another_companys_row_is_404(): void
    {
        $nora = User::where('first_name', 'Nora')->first();
        $nora->accessibleCompanies()->attach($this->north->id, ['granted_status' => 'accepted']);

        $this->actingAs($this->admin)->postJson(self::URL."/{$this->cara->id}/revoke")->assertNotFound();
        $this->actingAs($this->admin)->postJson(self::URL."/{$nora->id}/revoke")->assertNotFound();
        $this->assertSame('accepted', DB::table('user_company_access')->where('user_id', $nora->id)->value('granted_status'));
    }

    public function test_guests_are_401_and_other_roles_403(): void
    {
        $this->getJson(self::URL)->assertUnauthorized();
        $this->actingAs($this->ana)->getJson(self::URL)->assertForbidden();
        $this->actingAs($this->ana)->postJson(self::URL."/{$this->guest->id}/revoke")->assertForbidden();
    }
}
