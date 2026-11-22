<?php

namespace Tests\Feature\Api;

use App\Mail\CompanyStatusMail;
use App\Models\Company;
use App\Models\Department;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

/**
 * Super Admin Companies tab (Framer vnNFYExpX) + C2 search, C3 sort, C5 Suspended view,
 * C6 suspend, C7 reactivate.
 *
 * Run:  php artisan test --filter=SuperAdminCompaniesTest
 */
class SuperAdminCompaniesTest extends TestCase
{
    use RefreshDatabase;

    private const URL = '/api/v1/superadmin/companies';

    private User $owner;

    private Company $apex;

    private Company $north;

    private User $john;

    protected function setUp(): void
    {
        parent::setUp();
        Mail::fake();

        $this->owner = User::factory()->superAdmin()->create(['first_name' => 'Felix', 'last_name' => 'V']);
        $this->apex = Company::factory()->create(['name' => 'Apex Holdings Inc.', 'address' => 'Makati City']);
        $this->north = Company::factory()->create(['name' => 'Northfield Academy', 'type' => 'school', 'address' => 'Davao City']);

        $this->john = User::factory()->admin()->create([
            'first_name' => 'John', 'last_name' => 'Doe', 'company_id' => $this->apex->id, 'personal_email' => 'john@gmail.com',
        ]);
        // 2 clerks in Apex (one through company access only), 1 in Northfield
        User::factory()->create(['company_id' => $this->apex->id]);
        User::factory()->create()->accessibleCompanies()->attach($this->apex->id, ['granted_status' => 'accepted']);
        User::factory()->create()->accessibleCompanies()->attach($this->apex->id, ['granted_status' => 'pending']); // not counted
        User::factory()->create(['company_id' => $this->north->id]);
        Department::factory()->count(2)->create(['company_id' => $this->apex->id]);
    }

    private function as(string $method, string $uri = '', array $data = [], ?User $user = null)
    {
        return $this->actingAs($user ?? $this->owner)->json($method, self::URL.$uri, $data);
    }

    // ------------------------------------------------------------- list

    public function test_lists_companies_with_counts_admin_and_summary(): void
    {
        $res = $this->as('GET')->assertOk();

        $res->assertJsonPath('meta.summary.total', 2)
            ->assertJsonPath('meta.summary.active', 2)
            ->assertJsonPath('meta.summary.suspended', 0)
            ->assertJsonPath('meta.summary.users', 4) // John + 2 Apex clerks + 1 Northfield (Super Admin and pending not counted)
            ->assertJsonPath('meta.views.all', 2)
            ->assertJsonPath('data.0.name', 'Apex Holdings Inc.') // Name A–Z
            ->assertJsonPath('data.0.users_count', 3)
            ->assertJsonPath('data.0.departments_count', 2)
            ->assertJsonPath('data.0.admin.full_name', 'John Doe')
            ->assertJsonPath('data.0.status', 'active')
            ->assertJsonPath('data.0.is_new', true)
            ->assertJsonPath('data.1.admin', null);

        // no money anywhere in the answer
        $this->assertStringNotContainsString('amount', $res->getContent());
    }

    public function test_search_view_and_sort(): void
    {
        $this->as('GET', '?search=north')->assertOk()
            ->assertJsonCount(1, 'data')->assertJsonPath('data.0.name', 'Northfield Academy')
            ->assertJsonPath('meta.views.all', 1);

        $this->as('GET', '?search=davao')->assertOk()->assertJsonCount(1, 'data'); // address matches too

        $this->as('GET', '?sort=name_desc')->assertOk()->assertJsonPath('data.0.name', 'Northfield Academy');
        $this->as('GET', '?sort=users')->assertOk()->assertJsonPath('data.0.name', 'Apex Holdings Inc.');

        $this->north->forceFill(['is_active' => false, 'suspended_at' => now(), 'suspended_by' => $this->owner->id, 'suspension_reason' => 'Unpaid'])->save();

        $this->as('GET', '?filter[view]=suspended')->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.status', 'suspended')
            ->assertJsonPath('data.0.suspension.reason', 'Unpaid')
            ->assertJsonPath('data.0.suspension.by_you', true);
        $this->as('GET', '?filter[view]=active')->assertOk()->assertJsonCount(1, 'data');
        $this->as('GET', '?suspended_first=1')->assertOk()->assertJsonPath('data.0.name', 'Northfield Academy');
    }

    public function test_last_activity_comes_from_the_audit_log(): void
    {
        DB::table('audit_logs')->insert([
            'user_id' => $this->john->id, 'company_id' => $this->apex->id, 'action' => 'login',
            'table_name' => 'users', 'record_id' => $this->john->id, 'created_at' => now()->subMinutes(3), 'updated_at' => now(),
        ]);

        $this->as('GET', '?sort=recent')->assertOk()
            ->assertJsonPath('data.0.name', 'Apex Holdings Inc.')
            ->assertJsonPath('data.1.last_activity_at', null);
    }

    public function test_invalid_filters_are_422(): void
    {
        $this->as('GET', '?sort=money')->assertStatus(422)->assertJsonValidationErrors('sort');
        $this->as('GET', '?filter[view]=deleted')->assertStatus(422);
    }

    public function test_only_super_admins_can_use_it(): void
    {
        $this->getJson(self::URL)->assertStatus(401);
        $this->as('GET', '', [], $this->john)->assertStatus(403);
        $this->as('POST', "/{$this->apex->id}/suspend", ['reason' => 'Testing it'], $this->john)->assertStatus(403);
    }

    // ------------------------------------------------------------- C6 suspend

    public function test_suspend_blocks_the_company_signs_people_out_and_tells_the_admin(): void
    {
        $clerk = User::factory()->create(['company_id' => $this->apex->id]);
        $clerk->accessibleCompanies()->attach($this->apex->id, ['granted_status' => 'accepted']);
        // works in another active company too: NOT signed out
        $both = User::factory()->create();
        $both->accessibleCompanies()->attach([$this->apex->id => ['granted_status' => 'accepted'], $this->north->id => ['granted_status' => 'accepted']]);
        foreach ([$this->john, $clerk, $both] as $u) {
            DB::table('sessions')->insert(['id' => 'sess-'.$u->id, 'user_id' => $u->id, 'payload' => '', 'last_activity' => time()]);
        }

        $res = $this->as('POST', "/{$this->apex->id}/suspend", ['reason' => '  Unpaid subscription for October.  ', 'notify_admin' => true])
            ->assertOk()
            ->assertJsonPath('data.status', 'suspended')
            ->assertJsonPath('data.suspension.reason', 'Unpaid subscription for October.')
            ->assertJsonPath('meta.admins_notified', true);

        // John (Admin) + this Apex-only clerk + the setUp clerk with Apex access. Not $both (Northfield is active).
        $this->assertSame(3, $res->json('meta.signed_out'));
        $this->assertDatabaseMissing('sessions', ['user_id' => $this->john->id]);
        $this->assertDatabaseMissing('sessions', ['user_id' => $clerk->id]);
        $this->assertDatabaseHas('sessions', ['user_id' => $both->id]);

        $this->assertDatabaseHas('companies', ['id' => $this->apex->id, 'is_active' => false, 'suspended_by' => $this->owner->id]);
        $this->assertDatabaseHas('audit_logs', ['action' => 'company_suspended', 'record_id' => $this->apex->id, 'company_id' => $this->apex->id]);
        $this->assertDatabaseHas('notifications', ['recipient_id' => $this->john->id, 'type' => 'company_changed']);
        Mail::assertSent(CompanyStatusMail::class, fn ($mail) => $mail->hasTo('john@gmail.com') && $mail->what === 'suspended');

        // John is now refused at his next request
        $this->actingAs($this->john)->getJson('/api/v1/auth/me')->assertStatus(403)->assertJsonPath('code', 'COMPANY_SUSPENDED');
    }

    public function test_suspend_without_notifying_the_admin(): void
    {
        $this->as('POST', "/{$this->apex->id}/suspend", ['reason' => 'Contract review', 'notify_admin' => false])
            ->assertOk()->assertJsonPath('meta.admins_notified', null);

        Mail::assertNothingSent();
    }

    public function test_suspend_needs_a_reason(): void
    {
        $this->as('POST', "/{$this->apex->id}/suspend", ['reason' => '   '])
            ->assertStatus(422)->assertJsonValidationErrors('reason');
    }

    public function test_suspending_twice_is_409(): void
    {
        $this->as('POST', "/{$this->apex->id}/suspend", ['reason' => 'Contract review'])->assertOk();
        $this->as('POST', "/{$this->apex->id}/suspend", ['reason' => 'Contract review'])
            ->assertStatus(409)->assertJsonPath('code', 'COMPANY_ALREADY_SUSPENDED');
    }

    public function test_unknown_company_is_404(): void
    {
        $this->as('POST', '/999999/suspend', ['reason' => 'Contract review'])->assertStatus(404);
    }

    // ------------------------------------------------------------- C7 reactivate

    public function test_reactivate_lets_everyone_back_in(): void
    {
        $this->as('POST', "/{$this->apex->id}/suspend", ['reason' => 'Contract review', 'notify_admin' => false])->assertOk();

        $this->as('POST', "/{$this->apex->id}/reactivate", ['note' => 'Contract renewed on Nov 17'])
            ->assertOk()
            ->assertJsonPath('data.status', 'active')
            ->assertJsonPath('data.suspension', null)
            ->assertJsonPath('meta.admins_notified', true);

        $this->assertDatabaseHas('companies', ['id' => $this->apex->id, 'is_active' => true, 'suspended_at' => null, 'suspension_reason' => null]);
        $this->assertDatabaseHas('audit_logs', ['action' => 'company_reactivated', 'record_id' => $this->apex->id]);
        Mail::assertSent(CompanyStatusMail::class, fn ($mail) => $mail->what === 'reactivated');

        $this->actingAs($this->john)->getJson('/api/v1/auth/me')->assertOk();
    }

    public function test_reactivating_an_active_company_is_409(): void
    {
        $this->as('POST', "/{$this->apex->id}/reactivate")
            ->assertStatus(409)->assertJsonPath('code', 'COMPANY_NOT_SUSPENDED');
    }

    // ------------------------------------------------------------- C1 export

    private function export(array $query, ?User $user = null)
    {
        return $this->actingAs($user ?? $this->owner)->get(self::URL.'/export?'.http_build_query($query), ['Accept' => 'application/json']);
    }

    public function test_export_csv_has_the_chosen_columns_and_is_audited(): void
    {
        $this->as('POST', "/{$this->north->id}/suspend", ['reason' => '=HYPERLINK("x")', 'notify_admin' => false])->assertOk();

        $res = $this->export(['format' => 'csv', 'companies' => 'all', 'columns' => ['details', 'counts', 'suspension']])
            ->assertOk()
            ->assertHeader('Content-Type', 'text/csv; charset=UTF-8')
            ->assertHeader('Cache-Control', 'no-store, private');
        $csv = $res->getContent();

        $this->assertStringContainsString('Company,Type,Address,Status,"Admin in charge"', $csv);
        $this->assertStringContainsString('"Apex Holdings Inc.",Corporation,"Makati City",Active,"John Doe"', $csv);
        $this->assertStringContainsString(',3,', $csv); // Apex users_count
        $this->assertStringContainsString("'=HYPERLINK", $csv); // formula injection neutralised
        $this->assertStringNotContainsString('amount', strtolower($csv));
        $this->assertDatabaseHas('audit_logs', ['action' => 'companies_exported', 'user_id' => $this->owner->id]);
    }

    public function test_export_only_suspended_or_matching_a_search(): void
    {
        $this->as('POST', "/{$this->north->id}/suspend", ['reason' => 'Contract review', 'notify_admin' => false])->assertOk();

        $csv = $this->export(['format' => 'csv', 'companies' => 'suspended', 'columns' => ['details']])->assertOk()->getContent();
        $this->assertStringContainsString('Northfield', $csv);
        $this->assertStringNotContainsString('Apex', $csv);

        $csv = $this->export(['format' => 'csv', 'companies' => 'search', 'search' => 'apex', 'columns' => ['details']])->assertOk()->getContent();
        $this->assertStringContainsString('Apex', $csv);
        $this->assertStringNotContainsString('Northfield', $csv);
    }

    public function test_export_xlsx_and_pdf(): void
    {
        $xlsx = $this->export(['format' => 'xlsx', 'companies' => 'all', 'columns' => ['details', 'counts']])->assertOk();
        $this->assertSame('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', $xlsx->headers->get('Content-Type'));
        $this->assertStringStartsWith('PK', $xlsx->getContent()); // an xlsx file is a zip

        $pdf = $this->export(['format' => 'pdf', 'companies' => 'all', 'columns' => ['details']])->assertOk();
        $this->assertStringStartsWith('%PDF', $pdf->getContent());
    }

    public function test_export_needs_a_format_and_a_column(): void
    {
        $this->export(['format' => 'docx', 'companies' => 'all', 'columns' => []])
            ->assertStatus(422)->assertJsonValidationErrors(['format', 'columns']);
        $this->export(['format' => 'csv', 'companies' => 'search', 'columns' => ['details']])
            ->assertStatus(422)->assertJsonValidationErrors('search');
        $this->export(['format' => 'csv', 'companies' => 'all', 'columns' => ['details']], $this->john)->assertStatus(403);
    }

    // ------------------------------------------------------------- C8 side panel

    public function test_panel_overview_has_card_data_and_largest_departments(): void
    {
        $ops = Department::factory()->create(['company_id' => $this->apex->id, 'name' => 'Operations']);
        User::factory()->count(2)->create(['company_id' => $this->apex->id, 'department_id' => $ops->id]);
        User::factory()->create(['company_id' => $this->apex->id, 'two_factor_confirmed_at' => now(), 'two_factor_secret' => 'secret']);

        $this->as('GET', "/{$this->apex->id}")
            ->assertOk()
            ->assertJsonPath('data.name', 'Apex Holdings Inc.')
            ->assertJsonPath('data.admin.full_name', 'John Doe')
            ->assertJsonPath('data.users_count', 6)
            ->assertJsonPath('data.departments_count', 3)
            ->assertJsonPath('data.two_factor_on', 1)
            ->assertJsonPath('data.largest_departments.0.name', 'Operations')
            ->assertJsonPath('data.largest_departments.0.users_count', 2)
            ->assertJsonCount(3, 'data.largest_departments');
    }

    public function test_panel_departments_users_and_history_tabs(): void
    {
        $this->as('GET', "/{$this->apex->id}/departments")->assertOk()->assertJsonCount(2, 'data');

        $this->as('GET', "/{$this->apex->id}/users")
            ->assertOk()
            ->assertJsonPath('meta.total', 3) // the pending-access user isn't counted
            ->assertJsonMissingPath('data.0.password');

        $this->as('POST', "/{$this->apex->id}/suspend", ['reason' => 'Contract review', 'notify_admin' => false])->assertOk();
        $this->as('POST', "/{$this->apex->id}/reactivate", ['note' => 'Renewed', 'notify_admin' => false])->assertOk();

        $this->as('GET', "/{$this->apex->id}/history")
            ->assertOk()
            ->assertJsonPath('meta.total', 2)
            ->assertJsonPath('data.0.action', 'company_reactivated') // newest first
            ->assertJsonPath('data.0.new.note', 'Renewed')
            ->assertJsonPath('data.1.new.reason', 'Contract review')
            ->assertJsonPath('data.1.by.full_name', 'Felix V');
    }

    public function test_panel_404_403_and_bad_page(): void
    {
        $this->as('GET', '/999999')->assertStatus(404);
        $this->as('GET', '/999999/users')->assertStatus(404);
        $this->as('GET', "/{$this->apex->id}", [], $this->john)->assertStatus(403);
        $this->as('GET', "/{$this->apex->id}/history?page=0")->assertStatus(422);
    }
}
