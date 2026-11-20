<?php

namespace Tests\Feature\Api;

use App\Mail\AccountInvitationMail;
use App\Mail\PasswordResetMail;
use App\Mail\TwoFactorSetupMail;
use App\Models\Company;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

/**
 * Admins tab click-flows: A1 export, A5 cancel invite, A6 bulk, A8 profile, A9 edit,
 * A10 password reset, A11 require two-step, A12 make Super Admin.
 *
 * Run:  php artisan test --filter=AdminAccountActionsTest
 */
class AdminAccountActionsTest extends TestCase
{
    use RefreshDatabase;

    private const URL = '/api/v1/superadmin/admins';

    private User $owner;

    private User $john;

    private Company $apex;

    private Company $green;

    protected function setUp(): void
    {
        parent::setUp();
        Mail::fake();
        $this->apex = Company::factory()->create(['name' => 'Apex Holdings']);
        $this->green = Company::factory()->create(['name' => 'Greenline Logistics']);
        $this->owner = User::factory()->superAdmin()->create(['first_name' => 'Felix', 'last_name' => 'V', 'last_login_at' => now()]);
        $this->john = User::factory()->admin()->create([
            'first_name' => 'John', 'last_name' => 'Doe', 'email' => 'johndoe@Administrator.com', 'employee_id' => 'EMP-2026-0002',
            'company_id' => $this->apex->id, 'personal_email' => 'john@gmail.com', 'last_login_at' => now()->subMinutes(5),
        ]);
    }

    private function as(string $method, string $uri, array $data = [])
    {
        return $this->actingAs($this->owner)->json($method, self::URL.$uri, $data);
    }

    private function turnOnTwoStep(User $user): void
    {
        $user->forceFill(['two_factor_secret' => 'JBSWY3DPEHPK3PXP', 'two_factor_confirmed_at' => now()])->save();
    }

    // ------------------------------------------------------------- A8 profile

    public function test_the_profile_has_details_security_facts_activity_and_notes(): void
    {
        DB::table('audit_logs')->insert([
            ['user_id' => $this->owner->id, 'action' => 'created', 'table_name' => 'users', 'record_id' => $this->john->id, 'new_values' => '{}', 'ip_address' => null, 'created_at' => now()->subDays(80)],
            ['user_id' => $this->john->id, 'action' => 'login', 'table_name' => 'users', 'record_id' => $this->john->id, 'new_values' => '{"device":"Chrome on Windows"}', 'ip_address' => '1.2.3.4', 'created_at' => now()->subMinutes(5)],
            ['user_id' => null, 'action' => 'login_failed', 'table_name' => 'users', 'record_id' => null, 'new_values' => '{"email":"johndoe@administrator.com"}', 'ip_address' => '9.9.9.9', 'created_at' => now()->subDay()],
        ]);

        $this->as('GET', "/{$this->john->id}")
            ->assertOk()
            ->assertJsonPath('data.employee_id', 'EMP-2026-0002')
            ->assertJsonPath('data.created_by', 'Felix V')
            ->assertJsonPath('data.last_sign_in.device', 'Chrome on Windows')
            ->assertJsonPath('data.failed_sign_ins_30d', 1)
            ->assertJsonPath('data.company.name', 'Apex Holdings')
            ->assertJsonPath('data.recent_activity.0.text', 'Signed in · Chrome on Windows')
            ->assertJsonPath('data.action_notes.edit', null)
            ->assertJsonPath('data.promotion.new_email', 'johndoe@Superadmin.com')
            ->assertJsonPath('data.promotion.checks.2', ['key' => 'two_factor', 'ok' => false, 'label' => 'Two-step sign-in is off. Every Super Admin must use it.'])
            ->assertJsonPath('data.promotion.company_left_without_admin', true);

        $this->as('GET', "/{$this->john->id}/activity")->assertOk()->assertJsonPath('meta.total', 1);
        $this->as('GET', '/'.User::factory()->create()->id)->assertNotFound(); // a clerk isn't managed here
    }

    // ------------------------------------------------------------- A9 edit

    public function test_edit_details_changes_name_email_company_and_signs_them_out(): void
    {
        DB::table('sessions')->insert(['id' => 's1', 'user_id' => $this->john->id, 'payload' => '-', 'last_activity' => time()]);

        $this->as('PATCH', "/{$this->john->id}", [
            'first_name' => 'John', 'last_name' => 'Doe', 'email_username' => 'John.Doe',
            'company_id' => $this->green->id, 'personal_email' => 'JD@Gmail.com',
        ])->assertOk()
            ->assertJsonPath('data.email', 'john.doe@Administrator.com')
            ->assertJsonPath('data.company.name', 'Greenline Logistics')
            ->assertJsonPath('meta.changed', fn ($changed) => collect($changed)->sort()->values()->all() === ['company_id', 'email', 'personal_email']);

        $this->assertDatabaseMissing('sessions', ['user_id' => $this->john->id]);
        $this->assertDatabaseHas('audit_logs', ['action' => 'updated', 'record_id' => $this->john->id]);
    }

    public function test_edit_refuses_a_taken_email_and_a_work_address_as_personal_email(): void
    {
        User::factory()->admin()->create(['email' => 'taken@Administrator.com']);

        $this->as('PATCH', "/{$this->john->id}", ['first_name' => 'John', 'last_name' => 'Doe', 'email_username' => 'taken', 'company_id' => $this->apex->id])
            ->assertStatus(422)->assertJsonValidationErrors(['email_username' => 'An account with this email already exists.']);
        $this->as('PATCH', "/{$this->john->id}", ['first_name' => 'John', 'last_name' => 'Doe', 'email_username' => 'johndoe', 'company_id' => $this->apex->id, 'personal_email' => 'x@clerk.com'])
            ->assertStatus(422)->assertJsonValidationErrors('personal_email');
    }

    public function test_changing_a_pending_admins_email_sends_a_new_invitation(): void
    {
        $carlo = User::factory()->admin()->pending()->create(['company_id' => $this->apex->id, 'personal_email' => 'c@gmail.com', 'last_login_at' => null]);

        $this->as('PATCH', "/{$carlo->id}", ['first_name' => 'Carlo', 'last_name' => 'Reyes', 'email_username' => 'carlo.reyes', 'company_id' => $this->apex->id, 'personal_email' => 'c@gmail.com'])
            ->assertOk()->assertJsonPath('meta.invitation_resent', true);
        Mail::assertSent(AccountInvitationMail::class);
    }

    // ------------------------------------------------------------- A10 reset

    public function test_reset_without_signing_out_keeps_the_old_password(): void
    {
        DB::table('sessions')->insert(['id' => 's1', 'user_id' => $this->john->id, 'payload' => '-', 'last_activity' => time()]);

        $this->as('POST', "/{$this->john->id}/password-reset", ['sign_out' => false])->assertOk()->assertJsonPath('data.sent_to', 'john@gmail.com');

        $this->assertTrue(Hash::check('password', $this->john->fresh()->password));
        $this->assertDatabaseHas('sessions', ['user_id' => $this->john->id]);
        Mail::assertSent(PasswordResetMail::class, fn ($m) => $m->signedOut === false);
    }

    // ------------------------------------------------------------- A11 require two-step

    public function test_require_two_step_sets_a_deadline_and_emails_the_steps(): void
    {
        $this->as('POST', "/{$this->john->id}/two-factor", ['setup_days' => 3, 'email_steps' => true])
            ->assertOk()->assertJsonPath('data.emailed', true)->assertJsonPath('data.sent_to', 'john@gmail.com');

        $john = $this->john->fresh();
        $this->assertTrue($john->mustSetUpTwoFactor());
        $this->assertTrue($john->two_factor_setup_deadline->between(now()->addDays(3)->subMinute(), now()->addDays(3)->addMinute()));
        $this->assertSame('required', $john->twoFactorStatus());
        Mail::assertSent(TwoFactorSetupMail::class, fn ($m) => $m->hasTo('john@gmail.com') && $m->setupDays === 3);

        $this->as('POST', "/{$this->john->id}/two-factor", ['setup_days' => 3])->assertStatus(409); // already required
        $this->as('POST', "/{$this->john->id}/two-factor", ['setup_days' => 5])->assertStatus(422);
    }

    // ------------------------------------------------------------- A5 cancel invite

    public function test_cancel_invite_deletes_a_never_used_account(): void
    {
        $carlo = User::factory()->admin()->pending()->create(['email' => 'carlo@Administrator.com', 'last_login_at' => null]);
        DB::table('password_reset_tokens')->insert(['email' => $carlo->email, 'token' => 'x', 'created_at' => now()]);

        $this->as('DELETE', "/{$carlo->id}/invitation")->assertNoContent();

        $this->assertModelMissing($carlo);
        $this->assertDatabaseMissing('password_reset_tokens', ['email' => 'carlo@Administrator.com']);
        $this->assertDatabaseHas('audit_logs', ['action' => 'invitation_cancelled', 'record_id' => $carlo->id]);

        $this->as('DELETE', "/{$this->john->id}/invitation")->assertStatus(409); // he set his password long ago
    }

    // ------------------------------------------------------------- A12 make Super Admin

    public function test_make_super_admin_is_blocked_until_every_check_passes(): void
    {
        $this->as('POST', "/{$this->john->id}/promote", ['password' => 'password'])
            ->assertStatus(409)->assertJsonPath('code', 'PROMOTION_CHECK_FAILED')
            ->assertJsonPath('message', 'Two-step sign-in is off. Every Super Admin must use it.');
        $this->as('POST', "/{$this->john->id}/promote", ['password' => 'wrong'])->assertStatus(422);
    }

    public function test_make_super_admin_moves_role_email_and_company(): void
    {
        $this->turnOnTwoStep($this->john);

        $this->as('POST', "/{$this->john->id}/promote", ['password' => 'password'])
            ->assertOk()->assertJsonPath('data.role', 'super_admin')->assertJsonPath('data.email', 'johndoe@Superadmin.com');

        $john = $this->john->fresh();
        $this->assertNull($john->company_id);
        $this->assertDatabaseHas('audit_logs', ['action' => 'role_changed', 'record_id' => $john->id]);
        $this->assertDatabaseHas('security_alerts', ['type' => 'super_admin_added', 'user_id' => $john->id]);
    }

    public function test_no_promotion_when_all_seats_are_taken(): void
    {
        $this->turnOnTwoStep($this->john);
        User::factory()->superAdmin()->count(2)->create();

        $this->as('POST', "/{$this->john->id}/promote", ['password' => 'password'])
            ->assertStatus(409)->assertJsonPath('message', 'All 3 Super Admin seats are taken.');
    }

    // ------------------------------------------------------------- A6 bulk

    public function test_bulk_runs_each_allowed_account_and_reports_the_rest(): void
    {
        $liza = User::factory()->admin()->create(['first_name' => 'Liza', 'personal_email' => null]);

        $this->as('POST', '/bulk', ['action' => 'password_reset', 'ids' => [$this->john->id, $liza->id]])
            ->assertOk()
            ->assertJsonPath('meta', ['done' => 1, 'skipped' => 1])
            ->assertJsonFragment(['name' => $liza->full_name, 'ok' => false, 'message' => 'There is no personal email to send the link to.']);

        $this->as('POST', '/bulk', ['action' => 'deactivate', 'ids' => [$this->john->id, $this->owner->id]])
            ->assertStatus(422)->assertJsonValidationErrors('password');
        $this->as('POST', '/bulk', ['action' => 'deactivate', 'ids' => [$this->john->id, $this->owner->id], 'password' => 'password'])
            ->assertOk()->assertJsonPath('meta', ['done' => 1, 'skipped' => 1]); // never yourself
        $this->assertFalse($this->john->fresh()->is_active);
    }

    // ------------------------------------------------------------- A1 export

    public function test_export_csv_with_chosen_columns_and_an_audit_row(): void
    {
        $response = $this->actingAs($this->owner)->get(self::URL.'/export?format=csv&accounts=all&columns[]=name&columns[]=employee_id');

        $response->assertOk()->assertHeader('Content-Type', 'text/csv; charset=UTF-8');
        $csv = $response->getContent();
        $this->assertStringContainsString('Name,Email,"Employee ID"', $csv);
        $this->assertStringContainsString('"John Doe",johndoe@Administrator.com,EMP-2026-0002', $csv);
        $this->assertStringNotContainsString('password', strtolower($csv));
        $this->assertDatabaseHas('audit_logs', ['action' => 'admins_exported', 'user_id' => $this->owner->id]);
    }

    public function test_export_pdf_and_bad_input(): void
    {
        $this->actingAs($this->owner)->get(self::URL.'/export?format=pdf&accounts=selected&ids[]='.$this->john->id.'&columns[]=name')
            ->assertOk()->assertHeader('Content-Type', 'application/pdf');

        $this->actingAs($this->owner)->getJson(self::URL.'/export?format=xls&accounts=all&columns[]=name')->assertStatus(422);
        $this->actingAs($this->owner)->getJson(self::URL.'/export?format=csv&accounts=all')->assertStatus(422)
            ->assertJsonValidationErrors(['columns' => 'Tick at least one thing to include.']);
    }
}
