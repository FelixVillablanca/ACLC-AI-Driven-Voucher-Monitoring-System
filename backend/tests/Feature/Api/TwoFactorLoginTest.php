<?php

namespace Tests\Feature\Api;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use PragmaRX\Google2FA\Google2FA;
use Tests\TestCase;

/**
 * Two-step sign-in (Admins tab A11 / A12):
 *   POST /api/v1/auth/login → { two_factor: { stage: challenge | setup } }
 *   POST /auth/two-factor/challenge · GET|POST /auth/two-factor/setup · POST /auth/two-factor/skip
 *
 * Run:  php artisan test --filter=TwoFactorLoginTest
 */
class TwoFactorLoginTest extends TestCase
{
    use RefreshDatabase;

    private const FROM_SPA = ['Origin' => 'http://localhost:5173', 'Referer' => 'http://localhost:5173/login'];

    private const SECRET = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';

    private function login(string $email = 'john@administrator.com')
    {
        return $this->withHeaders(self::FROM_SPA)->postJson('/api/v1/auth/login', ['email' => $email, 'password' => 'password']);
    }

    private function code(string $secret = self::SECRET): string
    {
        return (new Google2FA)->getCurrentOtp($secret);
    }

    private function adminWithTwoStep(): User
    {
        return User::factory()->admin()->create([
            'email' => 'john@Administrator.com',
            'two_factor_secret' => self::SECRET,
            'two_factor_confirmed_at' => now(),
            'two_factor_recovery_codes' => [Hash::make('aaaaa-bbbbb')],
        ]);
    }

    public function test_with_two_step_on_the_password_alone_doesnt_sign_in(): void
    {
        $this->adminWithTwoStep();

        $this->login()->assertOk()->assertJsonPath('data.two_factor.stage', 'challenge')->assertJsonMissingPath('data.id');
        $this->withHeaders(self::FROM_SPA)->getJson('/api/v1/auth/me')->assertUnauthorized();

        $this->withHeaders(self::FROM_SPA)->postJson('/api/v1/auth/two-factor/challenge', ['code' => '000000'])
            ->assertStatus(422)->assertJsonValidationErrors('code');
        $this->assertDatabaseHas('audit_logs', ['action' => 'two_factor_failed']);

        $this->withHeaders(self::FROM_SPA)->postJson('/api/v1/auth/two-factor/challenge', ['code' => $this->code()])
            ->assertOk()->assertJsonPath('data.email', 'john@Administrator.com');
        $this->withHeaders(self::FROM_SPA)->getJson('/api/v1/auth/me')->assertOk();
        $this->assertDatabaseHas('audit_logs', ['action' => 'login']);
    }

    public function test_a_backup_code_works_once(): void
    {
        $john = $this->adminWithTwoStep();

        $this->login();
        $this->withHeaders(self::FROM_SPA)->postJson('/api/v1/auth/two-factor/challenge', ['recovery_code' => 'AAAAA-BBBBB'])->assertOk();
        $this->assertSame([], $john->fresh()->two_factor_recovery_codes);

        $this->withHeaders(self::FROM_SPA)->postJson('/api/v1/auth/logout');
        $this->login();
        $this->withHeaders(self::FROM_SPA)->postJson('/api/v1/auth/two-factor/challenge', ['recovery_code' => 'aaaaa-bbbbb'])
            ->assertStatus(422)->assertJsonValidationErrors('recovery_code');
    }

    public function test_the_code_step_needs_a_password_first(): void
    {
        $this->withHeaders(self::FROM_SPA)->postJson('/api/v1/auth/two-factor/challenge', ['code' => '123456'])
            ->assertStatus(401)->assertJsonPath('code', 'TWO_FACTOR_EXPIRED');
    }

    public function test_required_two_step_is_set_up_at_sign_in_and_returns_backup_codes(): void
    {
        $john = User::factory()->admin()->create(['email' => 'john@Administrator.com', 'two_factor_required_at' => now(), 'two_factor_setup_deadline' => now()->addDays(3)]);

        $this->login()->assertOk()->assertJsonPath('data.two_factor.stage', 'setup')->assertJsonPath('data.two_factor.can_skip', true);

        $setup = $this->withHeaders(self::FROM_SPA)->getJson('/api/v1/auth/two-factor/setup')->assertOk();
        $this->assertStringContainsString('<svg', $setup->json('data.qr_svg'));
        $secret = str_replace(' ', '', $setup->json('data.secret'));
        // Asking again in the same sign-in shows the SAME key (the QR on screen stays valid)
        $this->assertSame($secret, str_replace(' ', '', $this->withHeaders(self::FROM_SPA)->getJson('/api/v1/auth/two-factor/setup')->json('data.secret')));

        $this->withHeaders(self::FROM_SPA)->postJson('/api/v1/auth/two-factor/setup', ['code' => $this->code($secret)])
            ->assertOk()->assertJsonCount(8, 'meta.recovery_codes')->assertJsonPath('data.email', 'john@Administrator.com');

        $john = $john->fresh();
        $this->assertTrue($john->hasTwoFactor());
        $this->assertNull($john->two_factor_required_at);
        $this->assertSame($secret, $john->two_factor_secret); // readable by the app…
        $this->assertNotSame($secret, DB::table('users')->where('id', $john->id)->value('two_factor_secret')); // …but encrypted in the DB
    }

    public function test_set_up_later_only_inside_the_window(): void
    {
        $john = User::factory()->admin()->create(['email' => 'john@Administrator.com', 'two_factor_required_at' => now(), 'two_factor_setup_deadline' => now()->addDay()]);
        $this->login();
        $this->withHeaders(self::FROM_SPA)->postJson('/api/v1/auth/two-factor/skip')->assertOk();

        $this->withHeaders(self::FROM_SPA)->postJson('/api/v1/auth/logout');
        $john->forceFill(['two_factor_setup_deadline' => now()->subMinute()])->save();
        $this->login()->assertJsonPath('data.two_factor.can_skip', false);
        $this->withHeaders(self::FROM_SPA)->postJson('/api/v1/auth/two-factor/skip')->assertStatus(409)->assertJsonPath('code', 'TWO_FACTOR_SETUP_OVERDUE');
    }

    public function test_someone_still_signed_in_after_the_deadline_is_signed_out(): void
    {
        $john = User::factory()->admin()->create(['two_factor_required_at' => now()->subDays(4), 'two_factor_setup_deadline' => now()->subDay()]);

        $this->actingAs($john)->getJson('/api/v1/auth/me')
            ->assertForbidden()->assertJsonPath('code', 'TWO_FACTOR_SETUP_REQUIRED');
    }

    public function test_without_two_step_nothing_changes(): void
    {
        User::factory()->admin()->create(['email' => 'john@Administrator.com']);

        $this->login()->assertOk()->assertJsonPath('data.email', 'john@Administrator.com');
    }
}
