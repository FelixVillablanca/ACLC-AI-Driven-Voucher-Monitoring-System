<?php

namespace Tests\Feature\Api;

use App\Models\Company;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * GET /api/v1/superadmin/places/search|reverse: the map pin's address search in "+ Add company"
 * (OpenStreetMap Nominatim, faked here: tests never call the real service).
 *
 * Run:  php artisan test --filter=SuperAdminPlacesTest
 */
class SuperAdminPlacesTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;

    protected function setUp(): void
    {
        parent::setUp();
        $this->owner = User::factory()->superAdmin()->create();
    }

    public function test_search_returns_places_and_sends_an_app_name_not_a_person(): void
    {
        Http::fake(['nominatim.openstreetmap.org/search*' => Http::response([
            ['lat' => '14.58697', 'lon' => '121.0614106', 'display_name' => 'Ortigas Center, Pasig, Metro Manila, Philippines',
                'osm_type' => 'way', 'osm_id' => 123456, 'type' => 'commercial_area'],
            ['lat' => 'x', 'lon' => '1'], // broken row: skipped
        ])]);

        $this->actingAs($this->owner)->getJson('/api/v1/superadmin/places/search?q='.urlencode('  Ortigas   Center '))
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0', [
                'label' => 'Ortigas Center, Pasig, Metro Manila, Philippines',
                'latitude' => '14.5869700', 'longitude' => '121.0614106', 'place_id' => 'way/123456', 'kind' => 'commercial area',
            ]);

        Http::assertSent(fn (Request $r) => $r['q'] === 'Ortigas Center' && $r['countrycodes'] === 'ph'
            && $r->hasHeader('User-Agent', 'ADVMS-voucher-monitoring/1.0')
            && ! str_contains($r->url(), $this->owner->email));
    }

    public function test_the_same_search_is_cached_and_sent_only_once(): void
    {
        Http::fake(['*' => Http::response([])]);

        $this->actingAs($this->owner)->getJson('/api/v1/superadmin/places/search?q=Cebu+City')->assertOk()->assertJsonCount(0, 'data');
        $this->actingAs($this->owner)->getJson('/api/v1/superadmin/places/search?q=Cebu+City')->assertOk();

        Http::assertSentCount(1);
    }

    public function test_reverse_gives_the_nearest_address_or_null(): void
    {
        Http::fake([
            '*lat=10.3157*' => Http::response(['lat' => '10.3157', 'lon' => '123.8854', 'display_name' => 'Osmeña Blvd, Cebu City',
                'osm_type' => 'node', 'osm_id' => 99, 'type' => 'house']),
            '*' => Http::response(['error' => 'Unable to geocode']),
        ]);

        $this->actingAs($this->owner)->getJson('/api/v1/superadmin/places/reverse?lat=10.3157&lng=123.8854')
            ->assertOk()->assertJsonPath('data.label', 'Osmeña Blvd, Cebu City')->assertJsonPath('data.place_id', 'node/99');

        $this->actingAs($this->owner)->getJson('/api/v1/superadmin/places/reverse?lat=0&lng=0')
            ->assertOk()->assertJsonPath('data', null);
    }

    public function test_when_the_service_is_down_it_is_503_with_a_clear_message(): void
    {
        Http::fake(['*' => Http::response('busy', 503)]);

        $this->actingAs($this->owner)->getJson('/api/v1/superadmin/places/search?q=Makati')
            ->assertStatus(503)->assertJsonPath('code', 'GEOCODER_UNAVAILABLE');
    }

    public function test_bad_input_is_422(): void
    {
        Http::fake();

        $this->actingAs($this->owner)->getJson('/api/v1/superadmin/places/search?q=pa')->assertUnprocessable()->assertJsonValidationErrors(['q']);
        $this->actingAs($this->owner)->getJson('/api/v1/superadmin/places/reverse?lat=95&lng=500')
            ->assertUnprocessable()->assertJsonValidationErrors(['lat', 'lng']);

        Http::assertNothingSent();
    }

    public function test_guest_is_401_and_other_roles_are_403(): void
    {
        Http::fake();

        $this->getJson('/api/v1/superadmin/places/search?q=Makati')->assertUnauthorized();

        $admin = User::factory()->admin()->create(['company_id' => Company::factory()->create()->id]);
        $this->actingAs($admin)->getJson('/api/v1/superadmin/places/search?q=Makati')->assertForbidden();

        Http::assertNothingSent();
    }
}
