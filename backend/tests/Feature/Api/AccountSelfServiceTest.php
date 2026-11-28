<?php

namespace Tests\Feature\Api;

use App\Domain\Identity\Account\OwnSessions;
use App\Domain\Platform\SystemSettings;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use PragmaRX\Google2FA\Google2FA;
use Tests\TestCase;

/**
 * The account menu pages (no Framer frames; built code-first 2026-11-21):
 *   GET|PATCH /api/v1/account · PUT /account/password · /account/two-factor/* · /account/sessions/*
 *   GET /account/activity · GET /account/support
 *
 * Run:  php artisan test --filter=AccountSelfServiceTest
 */
class AccountSelfServiceTest extends TestCase
{
    use RefreshDatabase;

    private const FROM_SPA = ['Origin' => 'http://localhost:5173', 'Referer' => 'http://localhost:5173/admin'];

    private function admin(array $attributes = []): User
    {
        return User::factory()->admin()->create([
            'first_name' => 'John', 'last_name' => 'Doe', 'email' => 'johndoe@Administrator.com',
            'personal_email' => 'john@gmail.com', ...$attributes,
        ]);
    }

    private function as(User $user)
    {
        $this->app['auth']->forgetGuards(); // don't carry the previous request's user over

        return $this->actingAs($user, 'web')->withHeaders(self::FROM_SPA);
    }

    private function superAdmin(): User
    {
        return User::factory()->superAdmin()->create(['email' => 'felix@Superadmin.com']);
    }

    // ---- Profile -----------------------------------------------------------------------------

    public function test_guests_get_401(): void
    {
        $this->withHeaders(self::FROM_SPA)->getJson('/api/v1/account')->assertUnauthorized();
        $this->withHeaders(self::FROM_SPA)->putJson('/api/v1/account/password', [])->assertUnauthorized();
    }

    public function test_the_profile_shows_only_your_own_account(): void
    {
        $john = $this->admin();
        $this->admin(['email' => 'other@Administrator.com', 'first_name' => 'Other']);

        $this->as($john)->getJson('/api/v1/account')
            ->assertOk()
            ->assertJsonPath('data.id', $john->id)
            ->assertJsonPath('data.full_name', 'John Doe')
            ->assertJsonPath('data.personal_email', 'john@gmail.com')
            ->assertJsonPath('data.two_factor.status', 'off')
            ->assertJsonMissingPath('data.password');
    }

    public function test_you_can_change_your_name_without_a_password(): void
    {
        $john = $this->admin();

        $this->as($john)->patchJson('/api/v1/account', ['first_name' => 'Jonathan', 'was' => ['first_name' => 'John']])
            ->assertOk()
            ->assertJsonPath('data.first_name', 'Jonathan')
            ->assertJsonPath('meta.changed', ['first_name']);

        $this->assertSame('Jonathan', $john->fresh()->first_name);
        $this->assertSame('johndoe@Administrator.com', $john->fresh()->email); // the sign-in email never changes here
        $this->assertDatabaseHas('audit_logs', ['action' => 'profile_updated', 'user_id' => $john->id]);
    }

    public function test_the_sign_in_email_and_role_cannot_be_changed_here(): void
    {
        $john = $this->admin();

        $this->as($john)->patchJson('/api/v1/account', ['email' => 'x@Superadmin.com', 'role' => 'super_admin', 'first_name' => 'John'])
            ->assertStatus(409)->assertJsonPath('code', 'NOTHING_CHANGED');

        $this->assertSame('admin', $john->fresh()->role);
        $this->assertSame('johndoe@Administrator.com', $john->fresh()->email);
    }

    public function test_changing_the_personal_email_needs_your_password_and_alerts_the_owners(): void
    {
        $john = $this->admin();
        $owner = $this->superAdmin();

        $this->as($john)->patchJson('/api/v1/account', ['personal_email' => 'new@gmail.com'])
            ->assertStatus(422)->assertJsonValidationErrors('current_password');

        $this->as($john)->patchJson('/api/v1/account', ['personal_email' => 'new@gmail.com', 'current_password' => 'wrong'])
            ->assertStatus(422)->assertJsonValidationErrors('current_password');

        $this->as($john)->patchJson('/api/v1/account', ['personal_email' => 'x@Administrator.com', 'current_password' => 'password'])
            ->assertStatus(422)->assertJsonValidationErrors('personal_email');

        $this->as($john)->patchJson('/api/v1/account', ['personal_email' => 'New@Gmail.com', 'current_password' => 'password'])
            ->assertOk()->assertJsonPath('data.personal_email', 'new@gmail.com');

        $this->assertDatabaseHas('security_alerts', ['type' => 'personal_email_changed', 'user_id' => $john->id, 'severity' => 'low']);
        $this->assertDatabaseHas('notifications', ['recipient_id' => $owner->id, 'type' => 'security_alert']);
    }

    public function test_a_stale_screen_gets_409_instead_of_overwriting(): void
    {
        $john = $this->admin();

        $this->as($john)->patchJson('/api/v1/account', ['last_name' => 'Smith', 'was' => ['last_name' => 'Someone else']])
            ->assertStatus(409)->assertJsonPath('code', 'PROFILE_CHANGED');
        $this->assertSame('Doe', $john->fresh()->last_name);
    }

    public function test_names_are_validated(): void
    {
        $john = $this->admin();

        $this->as($john)->patchJson('/api/v1/account', ['first_name' => '   '])->assertStatus(422)->assertJsonValidationErrors('first_name');
        $this->as($john)->patchJson('/api/v1/account', ['last_name' => '<script>'])->assertStatus(422)->assertJsonValidationErrors('last_name');
        $this->as($john)->patchJson('/api/v1/account', [])->assertStatus(422);
    }

    // ---- Password ----------------------------------------------------------------------------

    public function test_changing_the_password_checks_the_old_one_and_the_rules(): void
    {
        $john = $this->admin();

        $this->as($john)->putJson('/api/v1/account/password', [
            'current_password' => 'wrong', 'password' => 'NewPassword123', 'password_confirmation' => 'NewPassword123',
        ])->assertStatus(422)->assertJsonValidationErrors('current_password');

        $this->as($john)->putJson('/api/v1/account/password', [
            'current_password' => 'password', 'password' => 'short1', 'password_confirmation' => 'short1',
        ])->assertStatus(422)->assertJsonValidationErrors('password');

        $this->as($john)->putJson('/api/v1/account/password', [
            'current_password' => 'password', 'password' => 'johndoe-2026-x', 'password_confirmation' => 'johndoe-2026-x',
        ])->assertStatus(422)->assertJsonValidationErrors('password'); // contains the email name

        $this->as($john)->putJson('/api/v1/account/password', [
            'current_password' => 'password', 'password' => 'NewPassword123', 'password_confirmation' => 'Different123',
        ])->assertStatus(422)->assertJsonValidationErrors('password');
    }

    public function test_a_new_password_signs_out_the_other_browsers_and_is_audited(): void
    {
        $john = $this->admin();
        $owner = $this->superAdmin();
        DB::table('sessions')->insert(['id' => 'other-browser', 'user_id' => $john->id, 'payload' => '', 'last_activity' => now()->timestamp]);

        $this->as($john)->putJson('/api/v1/account/password', [
            'current_password' => 'password', 'password' => 'Brand-new-pass-77', 'password_confirmation' => 'Brand-new-pass-77',
        ])->assertOk()->assertJsonPath('data.other_sessions_signed_out', 1);

        $this->assertTrue(Hash::check('Brand-new-pass-77', $john->fresh()->password));
        $this->assertDatabaseMissing('sessions', ['id' => 'other-browser']);
        $this->assertDatabaseHas('audit_logs', ['action' => 'password_changed', 'user_id' => $john->id]);
        $this->assertDatabaseHas('security_alerts', ['type' => 'password_changed', 'user_id' => $john->id]);
        $this->assertDatabaseHas('notifications', ['recipient_id' => $owner->id]);
    }

    /** Phase 7 step 1 (2026-11-28): the same for every role, and Officers / Supervisors can set up two-step themselves. */
    public function test_every_role_signs_out_other_browsers_and_can_start_two_step(): void
    {
        foreach (['accounting_clerk', 'accounting_officer', 'supervisor_manager'] as $i => $role) {
            $this->flushSession(); // a fresh browser per person (the session remembers the last password)
            $user = User::factory()->create(['role' => $role]);
            DB::table('sessions')->insert(['id' => "other-{$i}", 'user_id' => $user->id, 'payload' => '', 'last_activity' => now()->timestamp]);

            $setup = $this->as($user)->getJson('/api/v1/account/two-factor/setup');
            $this->assertSame(200, $setup->status(), "{$role}: two-step setup");

            $change = $this->as($user)->putJson('/api/v1/account/password', [
                'current_password' => 'password', 'password' => 'Brand-new-pass-77', 'password_confirmation' => 'Brand-new-pass-77',
            ]);
            $this->assertSame(200, $change->status(), "{$role}: password change ".$change->getContent());
            $this->assertSame(1, $change->json('data.other_sessions_signed_out'));
            $this->assertDatabaseMissing('sessions', ['id' => "other-{$i}"]);
        }
    }

    // ---- Two-step ----------------------------------------------------------------------------

    public function test_turning_two_step_on_from_settings(): void
    {
        $john = $this->admin();

        $this->as($john)->postJson('/api/v1/account/two-factor', ['code' => '123456'])
            ->assertStatus(409)->assertJsonPath('code', 'TWO_FACTOR_SETUP_EXPIRED'); // no QR code asked for yet

        $setup = $this->as($john)->getJson('/api/v1/account/two-factor/setup')->assertOk()->json('data');
        $this->assertStringContainsString('<svg', $setup['qr_svg']);
        $secret = str_replace(' ', '', $setup['secret']);

        $this->as($john)->postJson('/api/v1/account/two-factor', ['code' => '000000'])
            ->assertStatus(422)->assertJsonValidationErrors('code');

        $response = $this->as($john)->postJson('/api/v1/account/two-factor', ['code' => (new Google2FA)->getCurrentOtp($secret)])
            ->assertOk()->assertJsonPath('data.two_factor.status', 'on');
        $this->assertCount(8, $response->json('meta.recovery_codes'));
        $this->assertTrue($john->fresh()->hasTwoFactor());

        $this->as($john)->getJson('/api/v1/account/two-factor/setup')->assertStatus(409)->assertJsonPath('code', 'TWO_FACTOR_ALREADY_ON');
    }

    private function withTwoStep(User $user): User
    {
        $user->forceFill([
            'two_factor_secret' => 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP',
            'two_factor_confirmed_at' => now(),
            'two_factor_recovery_codes' => [Hash::make('aaaaa-bbbbb')],
        ])->save();

        return $user;
    }

    public function test_new_backup_codes_replace_the_old_ones(): void
    {
        $john = $this->withTwoStep($this->admin());

        $this->as($john)->postJson('/api/v1/account/two-factor/recovery-codes', ['password' => 'nope'])
            ->assertStatus(422)->assertJsonValidationErrors('password');

        $codes = $this->as($john)->postJson('/api/v1/account/two-factor/recovery-codes', ['password' => 'password'])
            ->assertOk()->json('data.recovery_codes');

        $this->assertCount(8, $codes);
        $stored = $john->fresh()->two_factor_recovery_codes;
        $this->assertFalse(collect($stored)->contains(fn ($hash) => Hash::check('aaaaa-bbbbb', $hash)));
    }

    public function test_turning_two_step_off_needs_the_password_and_alerts_the_owners(): void
    {
        $john = $this->withTwoStep($this->admin());
        $this->superAdmin();

        $this->as($john)->deleteJson('/api/v1/account/two-factor', ['password' => 'nope'])->assertStatus(422);

        $this->as($john)->deleteJson('/api/v1/account/two-factor', ['password' => 'password'])
            ->assertOk()->assertJsonPath('data.two_factor.status', 'off');

        $this->assertFalse($john->fresh()->hasTwoFactor());
        $this->assertDatabaseHas('audit_logs', ['action' => 'two_factor_disabled', 'user_id' => $john->id]);
        $this->assertDatabaseHas('security_alerts', ['type' => 'two_factor_turned_off', 'severity' => 'medium']);
    }

    public function test_two_step_cannot_be_turned_off_when_it_is_required(): void
    {
        $john = $this->withTwoStep($this->admin());
        DB::table('system_settings')->insert(['key' => SystemSettings::REQUIRE_TWO_FACTOR_FOR_ADMINS, 'value' => 'true', 'group' => 'security']);
        app(SystemSettings::class)->refresh();

        $this->as($john)->getJson('/api/v1/account')->assertJsonPath('data.two_factor.turn_off_blocked', 'Two-step sign-in is required for every Admin (a Global setting).');
        $this->as($john)->deleteJson('/api/v1/account/two-factor', ['password' => 'password'])
            ->assertForbidden()->assertJsonPath('code', 'TWO_FACTOR_REQUIRED');
        $this->assertTrue($john->fresh()->hasTwoFactor());
    }

    // ---- Sessions ----------------------------------------------------------------------------

    public function test_you_see_and_sign_out_only_your_own_browsers(): void
    {
        $john = $this->admin();
        $other = $this->admin(['email' => 'other@Administrator.com']);
        $now = now()->timestamp;
        DB::table('sessions')->insert([
            ['id' => 'johns-phone', 'user_id' => $john->id, 'payload' => '', 'last_activity' => $now,
                'user_agent' => 'Mozilla/5.0 (Linux; Android 14) Chrome/120.0 Mobile Safari/537.36', 'ip_address' => '10.0.0.5'],
            ['id' => 'johns-laptop', 'user_id' => $john->id, 'payload' => '', 'last_activity' => $now, 'user_agent' => null, 'ip_address' => null],
            ['id' => 'others-pc', 'user_id' => $other->id, 'payload' => '', 'last_activity' => $now, 'user_agent' => null, 'ip_address' => null],
        ]);

        $list = $this->as($john)->getJson('/api/v1/account/sessions')->assertOk()->json('data');
        $this->assertCount(2, $list);
        $this->assertSame('Chrome on Android', collect($list)->firstWhere('ip', '10.0.0.5')['device']);
        $this->assertStringNotContainsString('johns-phone', json_encode($list)); // the real session id never leaves

        // someone else's session: looks like it doesn't exist
        $this->as($john)->deleteJson('/api/v1/account/sessions/'.OwnSessions::key('others-pc'))->assertNotFound();
        $this->assertDatabaseHas('sessions', ['id' => 'others-pc']);

        $this->as($john)->deleteJson('/api/v1/account/sessions/'.OwnSessions::key('johns-phone'))->assertNoContent();
        $this->assertDatabaseMissing('sessions', ['id' => 'johns-phone']);

        $this->as($john)->postJson('/api/v1/account/sessions/sign-out-others')->assertOk()->assertJsonPath('data.signed_out', 1);
        $this->assertDatabaseMissing('sessions', ['id' => 'johns-laptop']);
        $this->assertDatabaseHas('sessions', ['id' => 'others-pc']);
    }

    // ---- Activity + support ------------------------------------------------------------------

    public function test_my_activity_lists_only_my_entries_with_filters(): void
    {
        $john = $this->admin();
        $other = $this->admin(['email' => 'other@Administrator.com']);
        foreach ([[$john, 'login'], [$john, 'profile_updated'], [$other, 'login']] as [$who, $action]) {
            DB::table('audit_logs')->insert(['user_id' => $who->id, 'action' => $action, 'table_name' => 'users', 'record_id' => $who->id,
                'new_values' => json_encode(['first_name' => 'X']), 'created_at' => now(), 'updated_at' => now()]);
        }

        $this->as($john)->getJson('/api/v1/account/activity')->assertOk()->assertJsonCount(2, 'data')->assertJsonPath('meta.total', 2);
        $this->as($john)->getJson('/api/v1/account/activity?type=security')->assertJsonCount(1, 'data')->assertJsonPath('data.0.action', 'login');
        $this->as($john)->getJson('/api/v1/account/activity?type=changes')->assertJsonCount(1, 'data')->assertJsonPath('data.0.action', 'profile_updated');
        $this->as($john)->getJson('/api/v1/account/activity?type=everything')->assertStatus(422);
    }

    public function test_support_lists_who_can_help_by_role(): void
    {
        $john = $this->admin();
        $owner = $this->superAdmin();

        $this->as($john)->getJson('/api/v1/account/support')->assertOk()
            ->assertJsonPath('data.contacts.0.email', $owner->email)
            ->assertJsonMissingPath('data.contacts.0.personal_email');

        // a Super Admin never sees themselves as their own helper
        $this->as($owner)->getJson('/api/v1/account/support')->assertOk()->assertJsonCount(0, 'data.contacts');
    }
}
