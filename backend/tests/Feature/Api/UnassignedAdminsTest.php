<?php

namespace Tests\Feature\Api;

use App\Mail\AccountInvitationMail;
use App\Models\Company;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

/**
 * Admins with "No company yet" (user decisions 2026-11-28):
 *  - Add admin may leave the company empty; the invitation says they'll get one later
 *  - such an Admin can sign in and use their account pages, but /api/v1/admin/* answers 403 NO_COMPANY_YET
 *  - "+ Add company" can optionally pick ONE of them as its Admin (GET /superadmin/companies/unassigned-admins)
 *
 * Run:  php artisan test --filter=UnassignedAdminsTest
 */
class UnassignedAdminsTest extends TestCase
{
    use RefreshDatabase;

    private const COMPANIES = '/api/v1/superadmin/companies';

    private User $owner;

    protected function setUp(): void
    {
        parent::setUp();
        Mail::fake();
        $this->owner = User::factory()->superAdmin()->create(['first_name' => 'Felix', 'last_name' => 'V']);
    }

    private function unassigned(array $attributes = []): User
    {
        return User::factory()->admin()->create(['company_id' => null, ...$attributes]);
    }

    public function test_an_admin_can_be_created_with_no_company_and_the_email_says_so(): void
    {
        $id = $this->actingAs($this->owner)->postJson('/api/v1/superadmin/admins', [
            'first_name' => 'Rhea', 'last_name' => 'Valdez', 'email_username' => 'rheavaldez',
            'personal_email' => 'rhea@gmail.com', 'company_id' => null,
        ])->assertCreated()->json('data.id');

        $this->assertNull(User::find($id)->company_id);
        Mail::assertSent(AccountInvitationMail::class, fn (AccountInvitationMail $mail) => $mail->companyName === null
            && str_contains($mail->render(), 'You don’t have a company yet'));
    }

    public function test_the_admin_console_waits_but_account_pages_still_work(): void
    {
        $admin = $this->unassigned();

        $this->actingAs($admin)->getJson('/api/v1/admin/dashboard')
            ->assertForbidden()->assertJsonPath('code', 'NO_COMPANY_YET');
        $this->actingAs($admin)->getJson('/api/v1/admin/users')->assertJsonPath('code', 'NO_COMPANY_YET');

        $this->actingAs($admin)->getJson('/api/v1/auth/me')->assertOk();
        $this->actingAs($admin)->getJson('/api/v1/account')->assertOk();
        $this->actingAs($admin)->getJson('/api/v1/notifications')->assertOk();
    }

    public function test_the_picker_lists_only_admins_who_can_be_given_a_company(): void
    {
        $rhea = $this->unassigned(['first_name' => 'Rhea', 'last_name' => 'Valdez']);
        $this->unassigned(['first_name' => 'Old', 'is_active' => false]); // deactivated
        User::factory()->admin()->create(['first_name' => 'Busy', 'company_id' => Company::factory()->create()->id]);
        User::factory()->create(['role' => 'accounting_clerk', 'company_id' => null]);

        $this->actingAs($this->owner)->getJson(self::COMPANIES.'/unassigned-admins')
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $rhea->id);

        $this->actingAs($this->owner)->getJson(self::COMPANIES.'/unassigned-admins?search=valdez')->assertJsonCount(1, 'data');
        $this->actingAs($this->owner)->getJson(self::COMPANIES.'/unassigned-admins?search=nobody')->assertJsonCount(0, 'data');
    }

    public function test_add_company_with_an_admin_gives_them_the_company_audits_and_tells_them(): void
    {
        $rhea = $this->unassigned(['first_name' => 'Rhea', 'last_name' => 'Valdez']);

        $id = $this->actingAs($this->owner)
            ->postJson(self::COMPANIES, ['name' => 'Bayview Logistics', 'type' => 'corporate', 'admin_id' => $rhea->id])
            ->assertCreated()
            ->assertJsonPath('data.admin.id', $rhea->id)
            ->json('data.id');

        $this->assertSame($id, $rhea->fresh()->company_id);
        $this->assertDatabaseHas('audit_logs', ['action' => 'admin_assigned', 'table_name' => 'users', 'record_id' => $rhea->id, 'company_id' => $id]);
        $this->assertDatabaseHas('notifications', ['recipient_id' => $rhea->id, 'title' => 'You have a company now']);

        // their console opens now
        $this->actingAs($rhea->fresh())->getJson('/api/v1/admin/dashboard')->assertOk();
    }

    public function test_an_admin_who_already_has_a_company_cannot_be_picked_and_nothing_is_saved(): void
    {
        $busy = User::factory()->admin()->create(['company_id' => Company::factory()->create()->id]);
        $old = $this->unassigned(['is_active' => false]);

        foreach ([$busy, $old] as $admin) {
            $this->actingAs($this->owner)
                ->postJson(self::COMPANIES, ['name' => 'Greenline Foods', 'type' => 'corporate', 'admin_id' => $admin->id])
                ->assertUnprocessable()
                ->assertJsonPath('errors.admin_id.0', 'This Admin already has a company or is no longer active. Pick another one.');
        }

        $this->assertDatabaseMissing('companies', ['name' => 'Greenline Foods']);
    }

    public function test_edit_details_can_give_an_unassigned_admin_a_company_or_leave_them_without(): void
    {
        $rhea = $this->unassigned(['first_name' => 'Rhea', 'last_name' => 'Valdez', 'email' => 'rheavaldez@Administrator.com', 'personal_email' => 'rhea@gmail.com']);
        $apex = Company::factory()->create();
        $body = ['first_name' => 'Rhea', 'last_name' => 'Valdez', 'email_username' => 'rheavaldez', 'personal_email' => 'rhea@gmail.com'];

        $this->actingAs($this->owner)->patchJson("/api/v1/superadmin/admins/{$rhea->id}", [...$body, 'first_name' => 'Rhea Mae', 'company_id' => null])
            ->assertOk();
        $this->assertNull($rhea->fresh()->company_id);

        $this->actingAs($this->owner)->patchJson("/api/v1/superadmin/admins/{$rhea->id}", [...$body, 'company_id' => $apex->id])->assertOk();
        $this->assertSame($apex->id, $rhea->fresh()->company_id);

        // once they have a company it can be changed, not removed
        $this->actingAs($this->owner)->patchJson("/api/v1/superadmin/admins/{$rhea->id}", [...$body, 'company_id' => null])
            ->assertUnprocessable()->assertJsonValidationErrors(['company_id']);
    }

    public function test_the_company_panel_gives_a_company_without_an_admin_one(): void
    {
        $rhea = $this->unassigned(['first_name' => 'Rhea', 'last_name' => 'Valdez']);
        $apex = Company::factory()->create(['name' => 'Apex']);
        $other = User::factory()->superAdmin()->create();

        $this->actingAs($this->owner)->postJson(self::COMPANIES."/{$apex->id}/admin", ['admin_id' => $rhea->id])
            ->assertOk()
            ->assertJsonPath('data.id', $apex->id)
            ->assertJsonPath('data.admin.id', $rhea->id);

        $this->assertSame($apex->id, $rhea->fresh()->company_id);
        $this->assertDatabaseHas('audit_logs', ['action' => 'admin_assigned', 'record_id' => $rhea->id, 'company_id' => $apex->id]);
        $this->assertDatabaseHas('notifications', ['recipient_id' => $rhea->id, 'title' => 'You have a company now']);
        $this->assertDatabaseHas('notifications', ['recipient_id' => $other->id, 'title' => 'Admin given a company']);
    }

    public function test_the_panel_refuses_a_company_that_has_an_admin_or_is_suspended_or_a_bad_pick(): void
    {
        $rhea = $this->unassigned();
        $run = Company::factory()->create();
        User::factory()->admin()->create(['company_id' => $run->id]);
        $suspended = Company::factory()->create(['is_active' => false]);
        $suspended->forceFill(['suspended_at' => now()])->save();
        $free = Company::factory()->create();

        $this->actingAs($this->owner)->postJson(self::COMPANIES."/{$run->id}/admin", ['admin_id' => $rhea->id])
            ->assertStatus(409)->assertJsonPath('code', 'COMPANY_HAS_ADMIN');
        $this->actingAs($this->owner)->postJson(self::COMPANIES."/{$suspended->id}/admin", ['admin_id' => $rhea->id])
            ->assertStatus(409)->assertJsonPath('code', 'COMPANY_NOT_ACTIVE');
        $this->actingAs($this->owner)->postJson(self::COMPANIES."/{$free->id}/admin", [])
            ->assertUnprocessable()->assertJsonValidationErrors(['admin_id']);
        $busy = User::factory()->admin()->create(['company_id' => $run->id]);
        $this->actingAs($this->owner)->postJson(self::COMPANIES."/{$free->id}/admin", ['admin_id' => $busy->id])
            ->assertUnprocessable()->assertJsonValidationErrors(['admin_id']);
        $this->actingAs($this->owner)->postJson(self::COMPANIES.'/999999/admin', ['admin_id' => $rhea->id])->assertNotFound();

        $this->assertNull($rhea->fresh()->company_id);
        $admin = User::factory()->admin()->create(['company_id' => $run->id]);
        $this->actingAs($admin)->postJson(self::COMPANIES."/{$free->id}/admin", ['admin_id' => $rhea->id])->assertForbidden();
    }

    public function test_the_admins_tab_assigns_an_admin_with_no_company_to_a_company_without_one(): void
    {
        $rhea = $this->unassigned(['first_name' => 'Rhea', 'last_name' => 'Valdez']);
        $free = Company::factory()->create(['name' => 'Bayview']);
        $run = Company::factory()->create(['name' => 'Apex']);
        User::factory()->admin()->create(['company_id' => $run->id]);
        $suspended = Company::factory()->create(['name' => 'Northfield', 'is_active' => false]);
        $suspended->forceFill(['suspended_at' => now()])->save();

        // the row offers the action, and the picker lists only companies nobody (active) runs
        $this->actingAs($this->owner)->getJson('/api/v1/superadmin/admins')
            ->assertJsonFragment(['assign_company' => true]);
        $this->actingAs($this->owner)->getJson('/api/v1/superadmin/admins/company-options')
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.name', 'Bayview');

        $this->actingAs($this->owner)->postJson("/api/v1/superadmin/admins/{$rhea->id}/company", ['company_id' => $free->id])
            ->assertOk()->assertJsonPath('data.company', 'Bayview')->assertJsonPath('data.company_deadline', null);

        $this->assertSame($free->id, $rhea->fresh()->company_id);
        $this->assertDatabaseHas('audit_logs', ['action' => 'admin_assigned', 'record_id' => $rhea->id, 'company_id' => $free->id]);
        $this->assertDatabaseHas('notifications', ['recipient_id' => $rhea->id, 'title' => 'You have a company now']);
    }

    public function test_assigning_from_the_admins_tab_is_refused_when_it_does_not_fit(): void
    {
        $rhea = $this->unassigned();
        $run = Company::factory()->create();
        $busy = User::factory()->admin()->create(['company_id' => $run->id]);
        $free = Company::factory()->create();
        $url = fn (User $u) => "/api/v1/superadmin/admins/{$u->id}/company";

        // a company that already has an Admin, or none chosen
        $this->actingAs($this->owner)->postJson($url($rhea), ['company_id' => $run->id])->assertUnprocessable()->assertJsonValidationErrors(['company_id']);
        $this->actingAs($this->owner)->postJson($url($rhea), [])->assertUnprocessable();
        // an Admin who already runs a company, a deactivated one, a Super Admin, a clerk
        $this->actingAs($this->owner)->postJson($url($busy), ['company_id' => $free->id])->assertStatus(409)->assertJsonPath('code', 'ACTION_NOT_ALLOWED');
        $old = $this->unassigned(['is_active' => false]);
        $this->actingAs($this->owner)->postJson($url($old), ['company_id' => $free->id])->assertStatus(409);
        $this->actingAs($this->owner)->postJson($url($this->owner), ['company_id' => $free->id])->assertStatus(409);
        $clerk = User::factory()->create(['role' => 'accounting_clerk', 'company_id' => null]);
        $this->actingAs($this->owner)->postJson($url($clerk), ['company_id' => $free->id])->assertNotFound();

        $this->assertNull($rhea->fresh()->company_id);
        $this->actingAs($busy)->postJson($url($rhea), ['company_id' => $free->id])->assertForbidden();
    }

    public function test_only_super_admins_see_the_picker(): void
    {
        $this->getJson(self::COMPANIES.'/unassigned-admins')->assertUnauthorized();
        $admin = User::factory()->admin()->create(['company_id' => Company::factory()->create()->id]);
        $this->actingAs($admin)->getJson(self::COMPANIES.'/unassigned-admins')->assertForbidden();
    }
}
