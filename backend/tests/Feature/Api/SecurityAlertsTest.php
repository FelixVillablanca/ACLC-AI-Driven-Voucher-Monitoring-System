<?php

namespace Tests\Feature\Api;

use App\Mail\PasswordResetMail;
use App\Models\Notification;
use App\Models\SecurityAlert;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

/**
 * Security alerts panel (Framer mQcXDCyDZ) + Alert detail (SCoT_cu7B).
 *
 *   The rules:  5 failed sign-ins in 5 minutes -> High;  Admin on a new device -> Medium;
 *               password changed via reset link -> Low
 *   The API:    GET/POST /api/v1/superadmin/security-alerts…,
 *               POST /api/v1/superadmin/admins/{id}/deactivate | reactivate | password-reset
 *
 * Run:  php artisan test --filter=SecurityAlertsTest
 */
class SecurityAlertsTest extends TestCase
{
    use RefreshDatabase;

    private const FROM_SPA = ['Origin' => 'http://localhost:5173', 'Referer' => 'http://localhost:5173/login'];

    private const CHROME_WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

    private const CHROME_ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36';

    private const URL = '/api/v1/superadmin/security-alerts';

    private User $owner;

    private User $otherOwner;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        Mail::fake();
        $this->owner = User::factory()->superAdmin()->create(['first_name' => 'Felix', 'last_name' => 'V']);
        $this->otherOwner = User::factory()->superAdmin()->create(['first_name' => 'Ana', 'last_name' => 'Cruz']);
        $this->admin = User::factory()->admin()->create([
            'first_name' => 'John', 'last_name' => 'Doe', 'email' => 'johndoe@Administrator.com', 'personal_email' => 'john@gmail.com',
        ]);
    }

    private function login(string $email, string $password, string $ip = '203.177.1.1', string $agent = self::CHROME_WINDOWS)
    {
        return $this->withHeaders([...self::FROM_SPA, 'User-Agent' => $agent])
            ->withServerVariables(['REMOTE_ADDR' => $ip])
            ->postJson('/api/v1/auth/login', ['email' => $email, 'password' => $password]);
    }

    private function failedAlert(): SecurityAlert
    {
        return SecurityAlert::create([
            'type' => 'failed_sign_ins', 'severity' => 'high', 'user_id' => $this->admin->id,
            'subject_email' => 'johndoe@administrator.com', 'ip_address' => '203.177.1.1', 'device' => 'Chrome on Windows',
            'event_count' => 5, 'first_seen_at' => now()->subMinutes(2), 'last_seen_at' => now(),
            'details' => ['events' => [['at' => now()->toIso8601String(), 'reason' => 'wrong_password', 'ip' => '203.177.1.1', 'device' => 'Chrome on Windows']]],
        ]);
    }

    // ---------------------------------------------------------------- the rules

    public function test_five_failed_sign_ins_raise_one_high_alert_and_ring_every_super_admin(): void
    {
        for ($i = 0; $i < 4; $i++) {
            $this->login('JohnDoe@Administrator.com', 'wrong')->assertStatus(422);
        }
        $this->assertSame(0, SecurityAlert::count()); // 4 isn't enough

        $this->login('johndoe@administrator.com', 'wrong')->assertStatus(422); // 5th: the same answer for the person

        $alert = SecurityAlert::sole();
        $this->assertSame('failed_sign_ins', $alert->type);
        $this->assertSame('high', $alert->severity);
        $this->assertSame('open', $alert->status);
        $this->assertSame($this->admin->id, $alert->user_id);
        $this->assertSame('johndoe@administrator.com', $alert->subject_email);
        $this->assertSame(5, $alert->event_count);
        $this->assertCount(5, $alert->details['events']);
        $this->assertSame('Chrome on Windows', $alert->device);
        $this->assertSame(2, Notification::where('type', 'security_alert')->count()); // both Super Admins

        // More failures (another IP, so the 5/min login limit doesn't stop it) are added to the SAME alert
        $this->login('johndoe@administrator.com', 'wrong', '180.190.77.4')->assertStatus(422);
        $this->assertSame(1, SecurityAlert::count());
        $this->assertSame(6, $alert->fresh()->event_count);
        $this->assertSame('180.190.77.4', $alert->fresh()->ip_address);
        $this->assertSame(2, Notification::where('type', 'security_alert')->count()); // no extra bell
    }

    public function test_failures_for_an_email_nobody_uses_are_watched_too(): void
    {
        for ($i = 0; $i < 5; $i++) {
            $this->login('ghost@administrator.com', 'guess')->assertStatus(422);
        }

        $alert = SecurityAlert::sole();
        $this->assertNull($alert->user_id);
        $this->assertSame('unknown_email', $alert->details['events'][0]['reason']);
        $this->assertDatabaseHas('audit_logs', ['action' => 'login_failed', 'user_id' => null]);
    }

    public function test_an_admin_on_a_new_device_raises_a_medium_alert_but_never_on_the_first_sign_in(): void
    {
        $this->login('johndoe@administrator.com', 'password')->assertOk(); // first ever: the starting point
        $this->post('/api/v1/auth/logout');
        $this->login('johndoe@administrator.com', 'password')->assertOk(); // same device
        $this->assertSame(0, SecurityAlert::count());
        $this->assertSame(2, DB::table('audit_logs')->where('action', 'login')->count());

        $this->post('/api/v1/auth/logout');
        $this->login('johndoe@administrator.com', 'password', '112.200.1.1', self::CHROME_ANDROID)->assertOk();

        $alert = SecurityAlert::sole();
        $this->assertSame('new_device_sign_in', $alert->type);
        $this->assertSame('medium', $alert->severity);
        $this->assertSame('Chrome on Android', $alert->device);
        $this->assertFalse($alert->details['ip_seen_before']);
    }

    public function test_company_users_on_a_new_device_are_not_alerted(): void
    {
        $clerk = User::factory()->create(['email' => 'maria@Clerk.com']);
        $this->login('maria@clerk.com', 'password')->assertOk();
        $this->post('/api/v1/auth/logout');
        $this->login('maria@clerk.com', 'password', '112.200.1.1', self::CHROME_ANDROID)->assertOk();

        $this->assertSame(0, SecurityAlert::count());
        $this->assertSame(2, DB::table('audit_logs')->where('action', 'login')->where('user_id', $clerk->id)->count());
    }

    // ---------------------------------------------------------------- list + detail

    public function test_the_list_is_newest_first_with_tab_counts(): void
    {
        $old = $this->failedAlert();
        SecurityAlert::create(['type' => 'password_changed', 'severity' => 'low', 'status' => 'reviewed', 'subject_email' => 'x@administrator.com',
            'reviewed_by' => $this->otherOwner->id, 'reviewed_at' => now()]);
        $new = SecurityAlert::create(['type' => 'new_device_sign_in', 'severity' => 'medium', 'subject_email' => 'liza@administrator.com']);

        $this->actingAs($this->owner)->getJson(self::URL)
            ->assertOk()
            ->assertJsonCount(3, 'data')
            ->assertJsonPath('data.0.id', $new->id)
            ->assertJsonPath('data.1.reviewed_by.full_name', 'Ana Cruz')
            ->assertJsonPath('data.2.account.full_name', 'John Doe')
            ->assertJsonPath('meta.counts', ['all' => 3, 'open' => 2, 'closed' => 1, 'last_24h' => 3]);

        $this->actingAs($this->owner)->getJson(self::URL.'?filter[status]=open')
            ->assertOk()->assertJsonCount(2, 'data')->assertJsonPath('data.1.id', $old->id);
        $this->actingAs($this->owner)->getJson(self::URL.'?filter[status]=closed')->assertOk()->assertJsonCount(1, 'data');
        $this->actingAs($this->owner)->getJson(self::URL.'?filter[status]=bogus')->assertStatus(422);
    }

    public function test_the_detail_has_the_account_what_happened_and_the_allowed_actions(): void
    {
        DB::table('audit_logs')->insert(['user_id' => $this->admin->id, 'action' => 'login', 'table_name' => 'users',
            'new_values' => json_encode(['device' => 'Edge on Windows']), 'ip_address' => '10.0.0.1', 'created_at' => now()->subHour()]);
        $alert = $this->failedAlert();

        $this->actingAs($this->owner)->getJson(self::URL.'/'.$alert->id)
            ->assertOk()
            ->assertJsonPath('data.rule', ['failures' => 5, 'minutes' => 5])
            ->assertJsonPath('data.account.status', 'active')
            ->assertJsonPath('data.account.last_good_sign_in.device', 'Edge on Windows')
            ->assertJsonPath('data.ip_seen_before', false)
            ->assertJsonCount(1, 'data.events')
            ->assertJsonPath('data.actions.deactivate', true)
            ->assertJsonPath('data.actions.reactivate', false)
            ->assertJsonPath('data.actions.reset_password', true)
            ->assertJsonPath('data.actions.account_note', null);
    }

    public function test_account_actions_follow_the_shared_rules(): void
    {
        // About ANOTHER Super Admin: may be deactivated (2 seats used, so not the last); no personal email to reset
        $aboutOwner = SecurityAlert::create(['type' => 'failed_sign_ins', 'severity' => 'high', 'user_id' => $this->otherOwner->id, 'subject_email' => 'ana@superadmin.com']);
        // About YOURSELF: never deactivate yourself
        $aboutMe = SecurityAlert::create(['type' => 'failed_sign_ins', 'severity' => 'high', 'user_id' => $this->owner->id, 'subject_email' => 'felix@superadmin.com']);
        $nobody = SecurityAlert::create(['type' => 'failed_sign_ins', 'severity' => 'high', 'subject_email' => 'ghost@administrator.com']);

        $this->actingAs($this->owner)->getJson(self::URL.'/'.$aboutOwner->id)
            ->assertJsonPath('data.actions.deactivate', true)
            ->assertJsonPath('data.actions.reset_password', false)
            ->assertJsonPath('data.actions.reset_note', 'There is no personal email to send the link to.');
        $this->actingAs($this->owner)->getJson(self::URL.'/'.$aboutMe->id)
            ->assertJsonPath('data.actions.deactivate', false)
            ->assertJsonPath('data.actions.account_note', 'You can’t deactivate your own account.');
        $this->actingAs($this->owner)->getJson(self::URL.'/'.$nobody->id)
            ->assertJsonPath('data.account', null)->assertJsonPath('data.actions.deactivate', false);
    }

    public function test_only_super_admins_get_in(): void
    {
        $this->getJson(self::URL)->assertUnauthorized();
        $this->actingAs($this->admin)->getJson(self::URL)->assertForbidden();
        $this->actingAs($this->owner)->getJson(self::URL.'/999')->assertNotFound();
    }

    // ---------------------------------------------------------------- review / dismiss

    public function test_review_and_dismiss_are_shared_and_a_second_click_gets_409(): void
    {
        $alert = $this->failedAlert();

        $this->actingAs($this->otherOwner)->postJson(self::URL."/{$alert->id}/review")
            ->assertOk()->assertJsonPath('data.status', 'reviewed')->assertJsonPath('data.reviewed_by.full_name', 'Ana Cruz');

        $this->actingAs($this->owner)->postJson(self::URL."/{$alert->id}/dismiss")
            ->assertStatus(409)->assertJsonPath('code', 'ALERT_ALREADY_CLOSED')
            ->assertJsonPath('message', 'This alert was already reviewed by Ana Cruz.');

        $this->assertDatabaseHas('audit_logs', ['action' => 'security_alert_reviewed', 'record_id' => $alert->id, 'user_id' => $this->otherOwner->id]);
    }

    public function test_dismiss_closes_an_alert_as_not_a_problem(): void
    {
        $alert = $this->failedAlert();
        $this->actingAs($this->owner)->postJson(self::URL."/{$alert->id}/dismiss")->assertOk()->assertJsonPath('data.status', 'dismissed');
    }

    public function test_mark_all_as_reviewed(): void
    {
        $this->failedAlert();
        $this->failedAlert();
        SecurityAlert::create(['type' => 'password_changed', 'severity' => 'low', 'status' => 'dismissed', 'subject_email' => 'x@administrator.com']);

        $this->actingAs($this->owner)->postJson(self::URL.'/review-all')
            ->assertOk()->assertJsonPath('data.reviewed', 2)->assertJsonPath('meta.counts.open', 0);
        $this->assertSame(1, SecurityAlert::where('status', 'dismissed')->count()); // untouched

        $this->actingAs($this->owner)->postJson(self::URL.'/review-all')->assertOk()->assertJsonPath('data.reviewed', 0);
    }

    // ---------------------------------------------------------------- lock / unlock

    public function test_deactivate_needs_the_super_admins_password(): void
    {
        $this->actingAs($this->owner)->postJson("/api/v1/superadmin/admins/{$this->admin->id}/deactivate", [])
            ->assertStatus(422)->assertJsonValidationErrors(['password' => 'Type your password to confirm.']);
        $this->actingAs($this->owner)->postJson("/api/v1/superadmin/admins/{$this->admin->id}/deactivate", ['password' => 'nope'])
            ->assertStatus(422)->assertJsonValidationErrors(['password' => 'That password is not correct.']);

        $this->assertTrue($this->admin->fresh()->is_active);
    }

    public function test_deactivate_signs_the_admin_out_closes_the_alert_and_tells_the_other_owners(): void
    {
        $alert = $this->failedAlert();
        DB::table('sessions')->insert(['id' => 'abc', 'user_id' => $this->admin->id, 'payload' => '-', 'last_activity' => time()]);

        $this->actingAs($this->owner)->postJson("/api/v1/superadmin/admins/{$this->admin->id}/deactivate", [
            'password' => 'password', 'security_alert_id' => $alert->id,
        ])->assertOk()->assertJsonPath('data.status', 'inactive');

        $this->assertFalse($this->admin->fresh()->is_active);
        $this->assertDatabaseMissing('sessions', ['user_id' => $this->admin->id]);
        $this->assertSame('reviewed', $alert->fresh()->status);
        $this->assertDatabaseHas('audit_logs', ['action' => 'account_deactivated', 'record_id' => $this->admin->id]);
        $this->assertDatabaseHas('notifications', ['recipient_id' => $this->otherOwner->id, 'title' => 'Account deactivated']);

        // The Admin can't sign in any more, and deactivating twice is a conflict
        $this->login('johndoe@administrator.com', 'password')->assertForbidden()->assertJsonPath('code', 'ACCOUNT_INACTIVE');
        $this->actingAs($this->owner)->postJson("/api/v1/superadmin/admins/{$this->admin->id}/deactivate", ['password' => 'password'])
            ->assertStatus(409)->assertJsonPath('code', 'ACTION_NOT_ALLOWED');

        // Reactivate brings them back
        $this->actingAs($this->owner)->postJson("/api/v1/superadmin/admins/{$this->admin->id}/reactivate")->assertOk();
        $this->assertTrue($this->admin->fresh()->is_active);
        $this->actingAs($this->owner)->postJson("/api/v1/superadmin/admins/{$this->admin->id}/reactivate")->assertStatus(409);
    }

    public function test_company_users_and_the_last_super_admin_are_protected(): void
    {
        $clerk = User::factory()->create();
        $this->actingAs($this->owner)->postJson("/api/v1/superadmin/admins/{$clerk->id}/deactivate", ['password' => 'password'])->assertNotFound();
        $this->actingAs($this->owner)->postJson("/api/v1/superadmin/admins/{$this->owner->id}/deactivate", ['password' => 'password'])
            ->assertStatus(409)->assertJsonPath('message', 'You can’t deactivate your own account.');
        $this->actingAs($this->admin)->postJson("/api/v1/superadmin/admins/{$this->admin->id}/reactivate")->assertForbidden();

        // Ana may be deactivated (Felix stays), but then Felix is the LAST one
        $this->actingAs($this->owner)->postJson("/api/v1/superadmin/admins/{$this->otherOwner->id}/deactivate", ['password' => 'password'])->assertOk();
        $this->actingAs($this->otherOwner->fresh())->getJson('/api/v1/superadmin/dashboard')->assertForbidden(); // signed out / blocked
    }

    // ---------------------------------------------------------------- password reset

    public function test_reset_emails_a_link_kills_the_old_password_and_the_link_sets_a_new_one(): void
    {
        $alert = $this->failedAlert();

        $this->actingAs($this->owner)->postJson("/api/v1/superadmin/admins/{$this->admin->id}/password-reset", ['security_alert_id' => $alert->id])
            ->assertOk()->assertJsonPath('data.sent_to', 'john@gmail.com');

        $link = null;
        Mail::assertSent(PasswordResetMail::class, function (PasswordResetMail $mail) use (&$link) {
            $link = $mail->link;

            return $mail->hasTo('john@gmail.com') && $mail->expiresInMinutes === 60;
        });
        $this->assertSame('reviewed', $alert->fresh()->status);
        $this->assertDatabaseHas('audit_logs', ['action' => 'password_reset_sent', 'record_id' => $this->admin->id]);

        $this->app['auth']->forgetGuards();
        $this->login('johndoe@administrator.com', 'password')->assertStatus(422); // the old password is gone

        parse_str(parse_url($link, PHP_URL_QUERY), $query);
        $this->postJson('/api/v1/auth/invitation/check', $query)->assertOk()->assertJsonPath('data.first_name', 'John');
        $this->postJson('/api/v1/auth/invitation/accept', [...$query, 'password' => 'N3w-Passw0rd!', 'password_confirmation' => 'N3w-Passw0rd!'])
            ->assertNoContent();

        $this->login('johndoe@administrator.com', 'N3w-Passw0rd!', '203.177.9.9')->assertOk();
        $this->assertDatabaseHas('security_alerts', ['type' => 'password_changed', 'severity' => 'low', 'user_id' => $this->admin->id]);
        $this->assertDatabaseHas('audit_logs', ['action' => 'password_reset_completed', 'user_id' => $this->admin->id]);
    }

    public function test_reset_needs_a_personal_email_and_an_activated_account(): void
    {
        $noEmail = User::factory()->admin()->create(['personal_email' => null]);
        $pending = User::factory()->admin()->pending()->create(['personal_email' => 'p@gmail.com']);

        $this->actingAs($this->owner)->postJson("/api/v1/superadmin/admins/{$noEmail->id}/password-reset")
            ->assertStatus(409)->assertJsonPath('message', 'There is no personal email to send the link to.');
        $this->actingAs($this->owner)->postJson("/api/v1/superadmin/admins/{$pending->id}/password-reset")
            ->assertStatus(409)->assertJsonPath('message', 'They haven’t set a password yet. Resend their invitation instead.');
        Mail::assertNothingSent();
    }

    public function test_when_the_email_fails_nothing_changes(): void
    {
        Mail::shouldReceive('to')->andThrow(new \RuntimeException('SMTP down'));
        $before = $this->admin->password;

        $this->actingAs($this->owner)->postJson("/api/v1/superadmin/admins/{$this->admin->id}/password-reset")
            ->assertStatus(503)->assertJsonPath('code', 'EMAIL_NOT_SENT');

        $this->assertSame($before, $this->admin->fresh()->password);
        $this->assertDatabaseMissing('password_reset_tokens', ['email' => $this->admin->email]);
    }
}
