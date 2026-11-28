<?php

namespace App\Domain\Platform\Geocoding;

use App\Exceptions\ApiException;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Address search for the company map pin, using OpenStreetMap's free Nominatim service (2026-11-28,
 * chosen instead of Google Maps: no card or key needed). The browser asks OUR server, which asks Nominatim, so
 * the service's rules are kept in one place (https://operations.osmfoundation.org/policies/nominatim/):
 *  - an app name in the User-Agent (a generic one: never a person's name or email)
 *  - at most 1 request a second for the whole app (calls wait their turn here)
 *  - answers are cached for a day, so the same search is never sent twice
 *
 * A result: { label, latitude, longitude, place_id ("way/123456"), kind ("building", "road", …) }.
 * Coordinates are strings with 7 decimals, like the companies.latitude/longitude columns.
 */
class Nominatim
{
    private const CACHE_HOURS = 24;

    private const LAST_CALL_KEY = 'nominatim:last-call';

    /** @return list<array{label: string, latitude: string, longitude: string, place_id: ?string, kind: ?string}> */
    public function search(string $query, int $limit = 5): array
    {
        $query = trim(preg_replace('/\s+/u', ' ', $query));
        $params = ['q' => $query, 'format' => 'jsonv2', 'addressdetails' => 0, 'limit' => $limit];
        if ($codes = trim((string) config('services.nominatim.country_codes'))) {
            $params['countrycodes'] = $codes;
        }

        $rows = $this->ask('search', $params);

        return array_values(array_filter(array_map(fn ($row) => $this->result($row), is_array($rows) ? $rows : [])));
    }

    /** The nearest address to a spot (a click on the map or a dragged pin), or null when there is none (the sea). */
    public function reverse(float $latitude, float $longitude): ?array
    {
        $row = $this->ask('reverse', [
            'lat' => round($latitude, 7), 'lon' => round($longitude, 7), 'format' => 'jsonv2', 'zoom' => 18, 'addressdetails' => 0,
        ]);

        return is_array($row) && ! isset($row['error']) ? $this->result($row) : null;
    }

    private function ask(string $endpoint, array $params): mixed
    {
        ksort($params);
        $key = 'nominatim:'.$endpoint.':'.sha1(json_encode($params));

        if (Cache::has($key)) {
            return Cache::get($key);
        }

        $this->waitForTurn();

        try {
            $response = Http::baseUrl(rtrim((string) config('services.nominatim.url'), '/'))
                ->withUserAgent((string) config('services.nominatim.user_agent'))
                ->withHeaders(['Accept-Language' => 'en'])
                ->timeout((int) config('services.nominatim.timeout', 8))
                ->acceptJson()
                ->get('/'.$endpoint, $params);
        } catch (ConnectionException $e) {
            Log::warning('Nominatim could not be reached', ['error' => $e->getMessage()]);
            throw $this->unavailable();
        }

        if (! $response->successful()) {
            Log::warning('Nominatim answered with an error', ['status' => $response->status()]);
            throw $this->unavailable();
        }

        $data = $response->json();
        Cache::put($key, $data, now()->addHours(self::CACHE_HOURS));

        return $data;
    }

    /** 1 request a second for the whole app: wait (up to a second) if the last one was too recent. */
    private function waitForTurn(): void
    {
        Cache::lock('nominatim:turn', 5)->block(5, function () {
            $last = (float) Cache::get(self::LAST_CALL_KEY, 0);
            $wait = 1.0 - (microtime(true) - $last);
            if ($wait > 0) {
                usleep((int) ceil(min($wait, 1.0) * 1_000_000));
            }
            Cache::put(self::LAST_CALL_KEY, microtime(true), 60);
        });
    }

    private function result(mixed $row): ?array
    {
        if (! is_array($row) || ! isset($row['lat'], $row['lon']) || ! is_numeric($row['lat']) || ! is_numeric($row['lon'])) {
            return null;
        }

        $type = $row['osm_type'] ?? null;
        $id = $row['osm_id'] ?? null;

        return [
            'label' => (string) ($row['display_name'] ?? ''),
            'latitude' => number_format((float) $row['lat'], 7, '.', ''),
            'longitude' => number_format((float) $row['lon'], 7, '.', ''),
            'place_id' => in_array($type, ['node', 'way', 'relation'], true) && is_numeric($id) ? "{$type}/{$id}" : null,
            'kind' => isset($row['type']) ? str_replace('_', ' ', (string) $row['type']) : null,
        ];
    }

    private function unavailable(): ApiException
    {
        return new ApiException(
            'The map search isn’t answering right now. Try again in a moment, or place the pin on the map by hand.',
            'GEOCODER_UNAVAILABLE',
            503,
        );
    }
}
