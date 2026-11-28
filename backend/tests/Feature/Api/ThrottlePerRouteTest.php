<?php

namespace Tests\Feature\Api;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

/**
 * `throttle:N,1` counts per ROUTE and person (App\Http\Middleware\ThrottlePerRoute, 2026-11-28). Before, every route with
 * an unnamed throttle shared one counter per person, so busy routes used up a strict route's allowance.
 *
 * Run:  php artisan test --filter=ThrottlePerRouteTest
 */
class ThrottlePerRouteTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Route::middleware(['api', 'throttle:2,1'])->get('/api/__busy', fn () => 'ok')->name('test.busy');
        Route::middleware(['api', 'throttle:2,1'])->get('/api/__strict', fn () => 'ok')->name('test.strict');
    }

    public function test_each_route_has_its_own_counter(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->getJson('/api/__busy')->assertOk();
        $this->actingAs($user)->getJson('/api/__busy')->assertOk();
        $this->actingAs($user)->getJson('/api/__busy')->assertStatus(429); // this route's limit is used up …

        $this->actingAs($user)->getJson('/api/__strict')->assertOk(); // … but not the other route's
    }

    public function test_the_counter_is_still_per_person(): void
    {
        $ana = User::factory()->create();
        $ben = User::factory()->create();

        $this->actingAs($ana)->getJson('/api/__strict')->assertOk();
        $this->actingAs($ana)->getJson('/api/__strict')->assertOk();
        $this->actingAs($ana)->getJson('/api/__strict')->assertStatus(429);

        $this->actingAs($ben)->getJson('/api/__strict')->assertOk();
    }
}
