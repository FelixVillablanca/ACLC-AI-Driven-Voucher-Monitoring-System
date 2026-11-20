<?php

namespace Tests\Feature\Api;

use App\Mail\AccountInvitationMail;
use App\Models\Company;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

/**
 * Create admin (Framer TkIHF89oH, revised 2026-11-20): ONE company per Admin, a personal email,
 * and a "set your password" link instead of a typed password.
 *
 *   POST /api/v1/superadmin/admins, GET /admins/form-defaults, POST /admins/{id}/invitation
 *   POST /api/v1/auth/invitation/check, POST /auth/invitation/accept (public, from the email link)
 *
 * Run:  php artisan test --filter=SuperAdminCreateAdminTest
 */
class SuperAdminCreateAdminTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;

    private Company $apex;

    protected function setUp(): void
    {
        parent::setUp();
        Mail::fake(); // nothing is really sent; we check what WOULD be sent
        $this->owner = User::factory()->superAdmin()->create(['employee_id' => null, 'first_name' => 'Felix', 'last_name' => 'V']);
        $this->apex = Company::factory()->create(['name' => 'Apex Holdings']);
    }

    private function create(array $overrides = [])
    {
        return $this->actingAs($this->owner)->postJson('/api/v1/superadmin/admins', array_merge([
            'first_name' => 'Carlo',
            'last_name' => 'Reyes',
            'email_username' => 'Carlo.Reyes',
            'company_id' => $this->apex->id,
            'personal_email' => 'Carlo.Reyes88@Gmail.com',
        ], $overrides));
    }

    /** The token inside the emailed link (the database only keeps a scrambled copy). */
    private function tokenFromEmail(): string
    {
        $link = null;
        Mail::assertSent(AccountInvitationMail::class, function (AccountInvitationMail $mail) use (&$link) {
            $link = $mail->link;

            return true;
        });
        parse_str(parse_url($link, PHP_URL_QUERY), $query);

        return $query['token'];
    }

    public function test_a_super_admin_creates_a_pending_admin_for_one_company_and_emails_the_link(): void
    {
        $otherOwner = User::factory()->superAdmin()->create(['employee_id' => null]);

        $response = $this->create()
            ->assertCreated()
            ->assertJsonPath('data.role', 'admin')
            ->assertJsonPath('data.email', 'carlo.reyes@Administrator.com')
            ->assertJsonPath('data.personal_email', 'carlo.reyes88@gmail.com')
            ->assertJsonPath('data.company.name', 'Apex Holdings')
            ->assertJsonPath('data.employee_id', 'EMP-'.now()->year.'-0001')
            ->assertJsonPath('meta.invitation_sent', true)
            ->assertJsonMissingPath('data.password');

        $admin = User::findOrFail($response->json('data.id'));
        $this->assertSame('pending', $admin->access_status);
        $this->assertSame($this->apex->id, $admin->company_id);

        Mail::assertSent(AccountInvitationMail::class, fn (AccountInvitationMail $mail) => $mail->hasTo('carlo.reyes88@gmail.com')
            && str_starts_with($mail->link, config('app.frontend_url').'/set-password?token=')
            && $mail->companyName === 'Apex Holdings');

        $this->assertDatabaseHas('audit_logs', ['user_id' => $this->owner->id, 'company_id' => $this->apex->id, 'action' => 'created', 'record_id' => $admin->id]);
        $this->assertDatabaseHas('audit_logs', ['action' => 'invitation_sent', 'record_id' => $admin->id]);
        $this->assertSame(1, Notification::where('recipient_id', $otherOwner->id)->where('type', 'user_changed')->count());

        // Pending on the Super Admin dashboard, with their company
        $this->actingAs($this->owner)->getJson('/api/v1/superadmin/dashboard')
            ->assertJsonPath('data.admins.0.status', 'pending')
            ->assertJsonPath('data.admins.0.company', 'Apex Holdings');
    }

    public function test_the_admin_cannot_sign_in_until_they_set_a_password_with_the_link(): void
    {
        $this->create()->assertCreated();
        $token = $this->tokenFromEmail();
        auth()->guard('web')->logout();
        $web = ['Referer' => 'http://localhost:5173'];

        // Before: blocked, and told to use the email
        $this->withHeaders($web)->postJson('/api/v1/auth/login', ['email' => 'carlo.reyes@Administrator.com', 'password' => 'anything123456'])
            ->assertUnprocessable(); // nobody knows the random starting password

        // The link is valid, and greets them by name
        $this->postJson('/api/v1/auth/invitation/check', ['email' => 'carlo.reyes@Administrator.com', 'token' => $token])
            ->assertOk()->assertJsonPath('data.first_name', 'Carlo');

        // Passwords must match and follow the rules
        $this->postJson('/api/v1/auth/invitation/accept', [
            'email' => 'carlo.reyes@Administrator.com', 'token' => $token, 'password' => 'MyOwnPass2026', 'password_confirmation' => 'Different2026',
        ])->assertUnprocessable()->assertJsonPath('errors.password.0', 'The two passwords don’t match.');

        $this->postJson('/api/v1/auth/invitation/accept', [
            'email' => 'carlo.reyes@Administrator.com', 'token' => $token, 'password' => 'MyOwnPass2026', 'password_confirmation' => 'MyOwnPass2026',
        ])->assertNoContent();

        $admin = User::where('email', 'carlo.reyes@Administrator.com')->first();
        $this->assertSame('accepted', $admin->access_status);
        $this->assertTrue(Hash::check('MyOwnPass2026', $admin->password));
        $this->assertDatabaseHas('audit_logs', ['action' => 'password_set', 'user_id' => $admin->id]);

        // The link works only once
        $this->postJson('/api/v1/auth/invitation/check', ['email' => 'carlo.reyes@Administrator.com', 'token' => $token])
            ->assertStatus(410)->assertJsonPath('code', 'INVITATION_INVALID');

        // And now they can sign in with THEIR password
        $this->withHeaders($web)->postJson('/api/v1/auth/login', ['email' => 'carlo.reyes@administrator.com', 'password' => 'MyOwnPass2026'])
            ->assertOk()->assertJsonPath('data.role', 'admin');
    }

    public function test_a_wrong_or_expired_link_is_refused(): void
    {
        $this->create()->assertCreated();
        $token = $this->tokenFromEmail();

        $this->postJson('/api/v1/auth/invitation/check', ['email' => 'carlo.reyes@Administrator.com', 'token' => 'made-up'])
            ->assertStatus(410)->assertJsonPath('code', 'INVITATION_INVALID');

        $this->travel(73)->hours();
        $this->postJson('/api/v1/auth/invitation/check', ['email' => 'carlo.reyes@Administrator.com', 'token' => $token])
            ->assertStatus(410);
    }

    public function test_resending_makes_a_new_link_and_the_old_one_stops_working(): void
    {
        $id = $this->create()->json('data.id');
        $oldToken = $this->tokenFromEmail();

        $this->actingAs($this->owner)->postJson("/api/v1/superadmin/admins/{$id}/invitation")
            ->assertOk()->assertJsonPath('data.sent_to', 'carlo.reyes88@gmail.com');
        Mail::assertSent(AccountInvitationMail::class, 2);

        $this->postJson('/api/v1/auth/invitation/check', ['email' => 'carlo.reyes@Administrator.com', 'token' => $oldToken])
            ->assertStatus(410);
    }

    public function test_resend_is_refused_once_the_password_is_set_or_for_non_admins(): void
    {
        $active = User::factory()->admin()->create(['company_id' => $this->apex->id]);
        $clerk = User::factory()->create(['access_status' => 'pending']);

        $this->actingAs($this->owner)->postJson("/api/v1/superadmin/admins/{$active->id}/invitation")
            ->assertStatus(409)->assertJsonPath('code', 'ACTION_NOT_ALLOWED')
            ->assertJsonPath('message', 'Only Admins who haven’t set a password yet get invitations.');
        $this->actingAs($this->owner)->postJson("/api/v1/superadmin/admins/{$clerk->id}/invitation")
            ->assertNotFound();
    }

    public function test_if_the_email_fails_the_admin_is_still_created_and_it_says_so(): void
    {
        Mail::shouldReceive('to')->andThrow(new \RuntimeException('SMTP down'));

        $this->create()
            ->assertCreated()
            ->assertJsonPath('meta.invitation_sent', false);

        $this->assertSame(1, User::where('role', 'admin')->count());
    }

    public function test_form_defaults_list_only_companies_an_admin_can_be_given(): void
    {
        User::factory()->admin()->create(['company_id' => $this->apex->id]);
        $suspended = Company::factory()->create(['name' => 'Northfield', 'is_active' => false]);
        $suspended->forceFill(['suspended_at' => now()])->save();
        Company::factory()->create(['name' => 'Bayview']);

        $this->actingAs($this->owner)->getJson('/api/v1/superadmin/admins/form-defaults')
            ->assertOk()
            ->assertJsonPath('data.companies', [
                ['id' => $this->apex->id, 'name' => 'Apex Holdings', 'admins_count' => 1],
                ['id' => Company::where('name', 'Bayview')->value('id'), 'name' => 'Bayview', 'admins_count' => 0],
            ]);
    }

    public function test_validation_errors_return_422_and_save_nothing(): void
    {
        $suspended = Company::factory()->create(['is_active' => false]);
        $suspended->forceFill(['suspended_at' => now()])->save();

        $this->actingAs($this->owner)->postJson('/api/v1/superadmin/admins', [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['first_name', 'last_name', 'email_username', 'company_id', 'personal_email']);

        $this->create(['company_id' => $suspended->id])->assertUnprocessable()
            ->assertJsonPath('errors.company_id.0', 'Choose an active company.');
        $this->create(['personal_email' => 'not-an-email'])->assertUnprocessable()
            ->assertJsonPath('errors.personal_email.0', 'Enter a valid email address, like name@gmail.com.');
        $this->create(['personal_email' => 'carlo@clerk.com'])->assertUnprocessable()
            ->assertJsonPath('errors.personal_email.0', 'Use their personal email (e.g. Gmail), not a work sign-in address.');
        $this->create(['email_username' => 'carlo@x.com'])->assertUnprocessable()
            ->assertJsonValidationErrors(['email_username']);

        $this->assertSame(0, User::where('role', 'admin')->count());
        $this->assertSame(0, DB::table('audit_logs')->count());
        Mail::assertNothingSent();
    }

    public function test_a_duplicate_work_email_returns_422(): void
    {
        User::factory()->admin()->create(['email' => 'carlo.reyes@Administrator.com']);

        $this->create(['email_username' => 'CARLO.REYES'])->assertUnprocessable()
            ->assertJsonPath('errors.email_username.0', 'An account with this email already exists.');
    }

    public function test_guests_get_401_and_other_roles_get_403(): void
    {
        $this->postJson('/api/v1/superadmin/admins', [])->assertUnauthorized();
        $this->getJson('/api/v1/superadmin/admins/form-defaults')->assertUnauthorized();

        foreach (['admin', 'accounting_clerk', 'accounting_officer', 'supervisor_manager'] as $role) {
            $this->actingAs(User::factory()->create(['role' => $role]))
                ->postJson('/api/v1/superadmin/admins', ['first_name' => 'X'])
                ->assertForbidden()
                ->assertJsonPath('code', 'FORBIDDEN');
        }
    }
}
