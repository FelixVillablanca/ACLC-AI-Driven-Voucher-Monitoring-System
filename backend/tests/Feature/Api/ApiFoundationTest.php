<?php

namespace Tests\Feature\Api;

use App\Exceptions\ApiException;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use RuntimeException;
use Tests\TestCase;

/**
 * Checks the API "foundation": the /api/v1 front door, tracking numbers,
 * and that EVERY kind of error comes back in the same JSON shape.
 *
 * Run:  php artisan test --filter=ApiFoundationTest
 */
class ApiFoundationTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        // Temporary routes that exist ONLY during these tests, to trigger each error type
        Route::middleware('api')->prefix('api/v1/_test')->group(function () {
            Route::post('/validation', fn (Request $r) => $r->validate(['amount' => 'required|numeric']));
            Route::get('/business-rule', fn () => throw new ApiException('This voucher can no longer be approved.', 'VOUCHER_INVALID_TRANSITION', 409));
            Route::get('/forbidden', fn () => throw new AuthorizationException);
            Route::get('/crash', fn () => throw new RuntimeException('secret database password is 1234'));
            Route::get('/login-required', fn () => 'hidden')->middleware('auth');
        });
    }

    public function test_health_check_says_ok(): void
    {
        $this->getJson('/api/v1/health')
            ->assertOk()
            ->assertJsonPath('data.status', 'ok')
            ->assertJsonPath('data.database', 'ok')
            ->assertHeader('X-Request-ID');
    }

    public function test_a_safe_tracking_number_sent_by_the_client_is_kept(): void
    {
        $this->getJson('/api/v1/health', ['X-Request-ID' => 'my-trace-12345'])
            ->assertHeader('X-Request-ID', 'my-trace-12345');
    }

    public function test_unknown_url_returns_standard_404(): void
    {
        $response = $this->getJson('/api/v1/this-does-not-exist')
            ->assertNotFound()
            ->assertJsonPath('code', 'NOT_FOUND')
            ->assertJsonStructure(['message', 'code', 'request_id']);

        // The tracking number in the body matches the one in the header
        $this->assertSame($response->headers->get('X-Request-ID'), $response->json('request_id'));
    }

    public function test_form_errors_return_422_with_field_list(): void
    {
        $this->postJson('/api/v1/_test/validation', [])
            ->assertUnprocessable()
            ->assertJsonPath('code', 'VALIDATION_FAILED')
            ->assertJsonStructure(['message', 'code', 'errors' => ['amount'], 'request_id']);
    }

    public function test_business_rule_errors_keep_their_own_code_and_status(): void
    {
        $this->getJson('/api/v1/_test/business-rule')
            ->assertStatus(409)
            ->assertJsonPath('code', 'VOUCHER_INVALID_TRANSITION')
            ->assertJsonPath('message', 'This voucher can no longer be approved.');
    }

    public function test_not_logged_in_returns_401(): void
    {
        $this->getJson('/api/v1/_test/login-required')
            ->assertUnauthorized()
            ->assertJsonPath('code', 'UNAUTHENTICATED');
    }

    public function test_no_permission_returns_403(): void
    {
        $this->getJson('/api/v1/_test/forbidden')
            ->assertForbidden()
            ->assertJsonPath('code', 'FORBIDDEN');
    }

    public function test_crash_details_are_hidden_from_users_in_production_mode(): void
    {
        config(['app.debug' => false]);

        $response = $this->getJson('/api/v1/_test/crash')
            ->assertStatus(500)
            ->assertJsonPath('code', 'SERVER_ERROR')
            ->assertJsonMissingPath('debug');

        $this->assertStringNotContainsString('secret', $response->getContent());
    }

    public function test_api_always_answers_json_even_without_accept_header(): void
    {
        $this->get('/api/v1/this-does-not-exist')
            ->assertNotFound()
            ->assertHeader('Content-Type', 'application/json');
    }
}
