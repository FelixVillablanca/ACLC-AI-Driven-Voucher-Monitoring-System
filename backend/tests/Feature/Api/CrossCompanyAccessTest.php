<?php

namespace Tests\Feature\Api;

use App\Models\Company;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Working in more than one company (2026-11-22):
 *   an Admin INVITES someone of another company → they accept / decline
 *   a clerk / officer / supervisor REQUESTS to join → that company's Admin approves / declines
 * Privacy: before joining, an Admin sees only name, role and home company.
 *
 * Run:  php artisan test --filter=CrossCompanyAccessTest
 */
class CrossCompanyAccessTest extends TestCase
{
    use RefreshDatabase;

    private Company $apex;

    private Company $north;

    private User $apexAdmin;

    private User $northAdmin;

    private User $gus; // Northfield clerk

    protected function setUp(): void
    {
        parent::setUp();
        $this->apex = Company::factory()->create(['name' => 'Apex']);
        $this->north = Company::factory()->create(['name' => 'Northfield']);
        $this->apexAdmin = User::factory()->admin()->create(['first_name' => 'John', 'last_name' => 'Doe', 'company_id' => $this->apex->id]);
        $this->northAdmin = User::factory()->admin()->create(['company_id' => $this->north->id]);
        $this->gus = User::factory()->create(['first_name' => 'Gus', 'last_name' => 'Tan', 'company_id' => $this->north->id]);
        $this->gus->accessibleCompanies()->attach($this->north->id, ['granted_status' => 'accepted']);
    }

    private function row(int $userId, int $companyId): ?object
    {
        return DB::table('user_company_access')->where('user_id', $userId)->where('company_id', $companyId)->first();
    }

    // ---------- the Admin's view of other companies ----------

    public function test_directory_shows_other_companies_people_with_name_role_and_home_company_only(): void
    {
        User::factory()->create(['first_name' => 'Ana', 'company_id' => $this->apex->id]); // own company: not here
        User::factory()->admin()->create(['first_name' => 'Nina', 'company_id' => $this->north->id]); // Admins never
        User::factory()->inactive()->create(['first_name' => 'Old', 'company_id' => $this->north->id]); // deactivated: no

        $this->actingAs($this->apexAdmin)->getJson('/api/v1/admin/company-access/directory')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertExactJson([
                'data' => [[
                    'id' => $this->gus->id, 'first_name' => 'Gus', 'last_name' => 'Tan', 'full_name' => 'Gus Tan',
                    'role' => 'accounting_clerk', 'home_company' => 'Northfield', 'previously_declined' => false,
                ]],
                'meta' => ['current_page' => 1, 'last_page' => 1, 'total' => 1],
            ]);

        // names and company names can be searched; emails can't
        $this->actingAs($this->apexAdmin)->getJson('/api/v1/admin/company-access/directory?search=north')->assertJsonCount(1, 'data');
        $this->actingAs($this->apexAdmin)->getJson('/api/v1/admin/company-access/directory?search='.urlencode($this->gus->email))->assertJsonCount(0, 'data');
    }

    public function test_invite_accept_flow(): void
    {
        $this->actingAs($this->apexAdmin)->postJson('/api/v1/admin/company-access/invitations', ['user_id' => $this->gus->id, 'message' => 'We need help with Q4'])
            ->assertCreated()
            ->assertJsonMissingPath('data.email');

        $this->assertSame('pending', $this->row($this->gus->id, $this->apex->id)->granted_status);
        $this->assertDatabaseHas('notifications', ['recipient_id' => $this->gus->id, 'title' => 'Invitation to join Apex']);
        // not yet: the invite gives no access
        $this->actingAs($this->gus)->getJson('/api/v1/clerk/dashboard', ['X-Company-ID' => (string) $this->apex->id])->assertForbidden();

        // the Admin sees it under Requests → invites; no longer invitable
        $this->actingAs($this->apexAdmin)->getJson('/api/v1/admin/company-access/pending')
            ->assertJsonPath('data.invites.0.full_name', 'Gus Tan')
            ->assertJsonPath('data.invites.0.email', null)
            ->assertJsonPath('data.invites.0.home_company', 'Northfield');
        $this->actingAs($this->apexAdmin)->getJson('/api/v1/admin/company-access/directory')->assertJsonCount(0, 'data');

        // Gus sees the invitation and accepts
        $this->actingAs($this->gus)->getJson('/api/v1/me/company-access')
            ->assertJsonPath('data.invitations.0.name', 'Apex')
            ->assertJsonPath('data.invitations.0.message', 'We need help with Q4')
            ->assertJsonPath('data.invitations.0.asked_by', 'John Doe');
        $this->actingAs($this->gus)->postJson("/api/v1/me/company-access/invitations/{$this->apex->id}/accept")->assertOk();

        $this->assertSame('accepted', $this->row($this->gus->id, $this->apex->id)->granted_status);
        $this->actingAs($this->gus)->getJson('/api/v1/clerk/dashboard', ['X-Company-ID' => (string) $this->apex->id])->assertOk();
        $this->assertDatabaseHas('notifications', ['recipient_id' => $this->apexAdmin->id, 'title' => 'Gus Tan joined Apex']);
        $this->assertDatabaseHas('audit_logs', ['action' => 'access_invite_accepted', 'company_id' => $this->apex->id]);

        // now on the From other companies view, with work email
        $this->actingAs($this->apexAdmin)->getJson('/api/v1/admin/company-access?filter[view]=other_companies')
            ->assertJsonPath('data.0.email', $this->gus->email);
    }

    public function test_invite_rules(): void
    {
        $ana = User::factory()->create(['company_id' => $this->apex->id]);
        $admin = User::factory()->admin()->create(['company_id' => $this->north->id]);

        $this->actingAs($this->apexAdmin)->postJson('/api/v1/admin/company-access/invitations', ['user_id' => $ana->id])
            ->assertStatus(409)->assertJsonPath('code', 'SAME_COMPANY');
        $this->actingAs($this->apexAdmin)->postJson('/api/v1/admin/company-access/invitations', ['user_id' => $admin->id])->assertNotFound();
        $this->actingAs($this->apexAdmin)->postJson('/api/v1/admin/company-access/invitations', ['user_id' => $this->gus->id])->assertCreated();
        $this->actingAs($this->apexAdmin)->postJson('/api/v1/admin/company-access/invitations', ['user_id' => $this->gus->id])
            ->assertStatus(409)->assertJsonPath('code', 'ACCESS_ALREADY_OPEN');
        $this->actingAs($this->apexAdmin)->postJson('/api/v1/admin/company-access/invitations', [])->assertUnprocessable();
    }

    public function test_decline_and_cancel_an_invite(): void
    {
        $this->actingAs($this->apexAdmin)->postJson('/api/v1/admin/company-access/invitations', ['user_id' => $this->gus->id])->assertCreated();
        $this->actingAs($this->gus)->postJson("/api/v1/me/company-access/invitations/{$this->apex->id}/decline")->assertNoContent();
        $this->assertSame('denied', $this->row($this->gus->id, $this->apex->id)->granted_status);

        // invitable again, marked as declined before; the old row is re-used
        $this->actingAs($this->apexAdmin)->getJson('/api/v1/admin/company-access/directory')->assertJsonPath('data.0.previously_declined', true);
        $this->actingAs($this->apexAdmin)->postJson('/api/v1/admin/company-access/invitations', ['user_id' => $this->gus->id])->assertCreated();
        $this->assertSame(1, DB::table('user_company_access')->where('user_id', $this->gus->id)->where('company_id', $this->apex->id)->count());

        $this->actingAs($this->apexAdmin)->deleteJson("/api/v1/admin/company-access/invitations/{$this->gus->id}")->assertNoContent();
        $this->assertNull($this->row($this->gus->id, $this->apex->id));
        $this->actingAs($this->gus)->postJson("/api/v1/me/company-access/invitations/{$this->apex->id}/accept")
            ->assertNotFound()->assertJsonPath('code', 'NOTHING_PENDING');
    }

    // ---------- the person asks ----------

    public function test_request_approve_flow(): void
    {
        $this->actingAs($this->gus)->getJson('/api/v1/me/company-access')
            ->assertJsonPath('data.companies.0.name', 'Northfield')
            ->assertJsonPath('data.companies.0.is_home', true)
            ->assertJsonPath('data.can_ask.0.name', 'Apex');

        $this->actingAs($this->gus)->postJson('/api/v1/me/company-access/requests', ['company_id' => $this->apex->id, 'message' => 'I cover Apex payables too'])
            ->assertCreated();
        $this->assertDatabaseHas('notifications', ['recipient_id' => $this->apexAdmin->id, 'title' => 'Request to join Apex']);
        $this->actingAs($this->gus)->getJson('/api/v1/me/company-access')->assertJsonPath('data.requests.0.name', 'Apex')->assertJsonPath('data.can_ask', []);

        $this->actingAs($this->apexAdmin)->getJson('/api/v1/admin/company-access/pending')
            ->assertJsonPath('data.requests.0.full_name', 'Gus Tan')
            ->assertJsonPath('data.requests.0.message', 'I cover Apex payables too')
            ->assertJsonPath('data.requests.0.email', null);
        $this->actingAs($this->apexAdmin)->getJson('/api/v1/admin/company-access')->assertJsonPath('meta.views.requests', 1);
        $this->actingAs($this->apexAdmin)->getJson('/api/v1/admin/dashboard')->assertJsonPath('data.needs_attention.0', ['type' => 'join_requests', 'count' => 1]);

        $this->actingAs($this->apexAdmin)->postJson("/api/v1/admin/company-access/requests/{$this->gus->id}/approve")->assertOk();
        $this->assertSame('accepted', $this->row($this->gus->id, $this->apex->id)->granted_status);
        $this->assertDatabaseHas('notifications', ['recipient_id' => $this->gus->id, 'title' => 'You can now work in Apex']);
        $this->actingAs($this->gus)->getJson('/api/v1/auth/me')->assertJsonCount(2, 'data.companies');
    }

    public function test_decline_and_cancel_a_request_and_its_rules(): void
    {
        $this->actingAs($this->gus)->postJson('/api/v1/me/company-access/requests', ['company_id' => $this->apex->id])->assertCreated();
        $this->actingAs($this->gus)->postJson('/api/v1/me/company-access/requests', ['company_id' => $this->apex->id])
            ->assertStatus(409)->assertJsonPath('code', 'ACCESS_ALREADY_OPEN');
        $this->actingAs($this->gus)->postJson('/api/v1/me/company-access/requests', ['company_id' => $this->north->id])
            ->assertStatus(409); // already works there

        $this->actingAs($this->apexAdmin)->postJson("/api/v1/admin/company-access/requests/{$this->gus->id}/decline", ['reason' => 'Not hiring'])->assertOk();
        $this->assertDatabaseHas('notifications', ['recipient_id' => $this->gus->id, 'title' => 'Your request to join Apex was declined']);
        // Northfield's Admin can't answer Apex's requests
        $this->actingAs($this->gus)->postJson('/api/v1/me/company-access/requests', ['company_id' => $this->apex->id])->assertCreated();
        $this->actingAs($this->northAdmin)->postJson("/api/v1/admin/company-access/requests/{$this->gus->id}/approve")->assertNotFound();

        $this->actingAs($this->gus)->deleteJson("/api/v1/me/company-access/requests/{$this->apex->id}")->assertNoContent();
        $this->assertNull($this->row($this->gus->id, $this->apex->id));

        $suspended = Company::factory()->create(['is_active' => false, 'suspended_at' => now(), 'suspension_reason' => 'x']);
        $this->actingAs($this->gus)->postJson('/api/v1/me/company-access/requests', ['company_id' => $suspended->id])->assertNotFound();
        $this->actingAs($this->gus)->postJson('/api/v1/me/company-access/requests', [])->assertUnprocessable();
    }

    public function test_who_may_use_these_endpoints(): void
    {
        $this->getJson('/api/v1/me/company-access')->assertUnauthorized();
        $this->actingAs($this->apexAdmin)->getJson('/api/v1/me/company-access')->assertForbidden(); // Admins run one company
        $this->actingAs($this->gus)->getJson('/api/v1/admin/company-access/directory')->assertForbidden();

        $officer = User::factory()->officer()->create(['company_id' => $this->north->id]);
        $this->actingAs($officer)->getJson('/api/v1/me/company-access')->assertOk(); // all 3 operational roles
    }
}
