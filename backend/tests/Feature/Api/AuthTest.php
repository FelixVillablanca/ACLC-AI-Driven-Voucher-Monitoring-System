<?php

namespace Tests\Feature\Api;

use App\Models\Company;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Login / me / logout (Login UI 2, Framer p0wwkrh66).
 *
 * The "Origin" header pretends the request comes from the React app
 * (localhost:5173), which is what makes Sanctum start a session cookie.
 *
 * Run:  php artisan test --filter=AuthTest
 */
class AuthTest extends TestCase
{
    use RefreshDatabase;

    private const FROM_SPA = ['Origin' => 'http://localhost:5173', 'Referer' => 'http://localhost:5173/login'];

    private function login(array $body)
    {
        return $this->withHeaders(self::FROM_SPA)->postJson('/api/v1/auth/login', $body);
    }

    public function test_a_user_can_log_in_and_gets_their_profile_and_companies(): void
    {
        $home = Company::factory()->create(['name' => 'Apex Holdings Inc.']);
        $other = Company::factory()->create(['name' => 'Northfield Academy']);
        $blocked = Company::factory()->create(['name' => 'Zeta Pending Corp']);

        $user = User::factory()->create(['email' => 'clerk@example.test', 'company_id' => $home->id]);
        $user->accessibleCompanies()->attach([
            $home->id => ['granted_status' => 'accepted'],
            $other->id => ['granted_status' => 'accepted'],
            $blocked->id => ['granted_status' => 'pending'], // not approved -> must NOT be listed
        ]);

        $this->login(['email' => 'clerk@example.test', 'password' => 'password'])
            ->assertOk()
            ->assertJsonPath('data.email', 'clerk@example.test')
            ->assertJsonPath('data.role', 'accounting_clerk')
            ->assertJsonPath('data.company.id', $home->id)
            ->assertJsonCount(2, 'data.companies')
            ->assertJsonMissingPath('data.password');

        $this->assertAuthenticatedAs($user);
        $this->assertNotNull($user->fresh()->last_login_at);
    }

    public function test_wrong_password_returns_422_without_saying_which_part_was_wrong(): void
    {
        User::factory()->create(['email' => 'clerk@example.test']);

        $this->login(['email' => 'clerk@example.test', 'password' => 'wrong-password'])
            ->assertUnprocessable()
            ->assertJsonPath('code', 'VALIDATION_FAILED')
            ->assertJsonPath('errors.email.0', 'These credentials do not match our records.');

        $this->assertGuest();
    }

    public function test_missing_fields_return_422_with_field_errors(): void
    {
        $this->login([])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['email', 'password']);
    }

    public function test_an_inactive_account_cannot_log_in(): void
    {
        User::factory()->inactive()->create(['email' => 'new@example.test']);

        $this->login(['email' => 'new@example.test', 'password' => 'password'])
            ->assertForbidden()
            ->assertJsonPath('code', 'ACCOUNT_INACTIVE');

        $this->assertGuest();
    }

    public function test_a_pending_account_cannot_log_in(): void
    {
        User::factory()->pending()->create(['email' => 'new@example.test']);

        $this->login(['email' => 'new@example.test', 'password' => 'password'])
            ->assertForbidden()
            ->assertJsonPath('code', 'ACCOUNT_INACTIVE');
    }

    public function test_login_is_rate_limited_after_5_attempts(): void
    {
        User::factory()->create(['email' => 'clerk@example.test']);

        foreach (range(1, 5) as $attempt) {
            $this->login(['email' => 'clerk@example.test', 'password' => 'wrong'])->assertUnprocessable();
        }

        $this->login(['email' => 'clerk@example.test', 'password' => 'wrong'])
            ->assertStatus(429)
            ->assertJsonPath('code', 'TOO_MANY_REQUESTS');
    }

    public function test_remember_me_sets_the_remember_cookie(): void
    {
        User::factory()->create(['email' => 'clerk@example.test']);

        $response = $this->login(['email' => 'clerk@example.test', 'password' => 'password', 'remember' => true])
            ->assertOk();

        $rememberCookie = collect($response->headers->getCookies())
            ->first(fn ($cookie) => str_starts_with($cookie->getName(), 'remember_web_'));

        $this->assertNotNull($rememberCookie, 'Expected a remember-me cookie.');
        // About 30 days (allow a minute of slack)
        $this->assertEqualsWithDelta(now()->addDays(30)->timestamp, $rememberCookie->getExpiresTime(), 60);
    }

    public function test_me_returns_the_logged_in_user(): void
    {
        $user = User::factory()->officer()->create();

        $this->actingAs($user)
            ->getJson('/api/v1/auth/me')
            ->assertOk()
            ->assertJsonPath('data.id', $user->id)
            ->assertJsonPath('data.role', 'accounting_officer');
    }

    public function test_me_returns_401_for_guests(): void
    {
        $this->getJson('/api/v1/auth/me')
            ->assertUnauthorized()
            ->assertJsonPath('code', 'UNAUTHENTICATED');
    }

    public function test_logout_ends_the_session(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->withHeaders(self::FROM_SPA)
            ->postJson('/api/v1/auth/logout')
            ->assertNoContent();

        $this->assertGuest('web');
    }
}
