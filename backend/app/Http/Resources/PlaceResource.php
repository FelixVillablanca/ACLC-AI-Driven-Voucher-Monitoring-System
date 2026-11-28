<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * One map search result (App\Domain\Platform\Geocoding\Nominatim):
 *   { label, latitude, longitude, place_id ("way/123456" or null), kind ("building", "road", …) }
 * Coordinates stay strings with 7 decimals, like the companies columns.
 */
class PlaceResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'label' => $this->resource['label'],
            'latitude' => $this->resource['latitude'],
            'longitude' => $this->resource['longitude'],
            'place_id' => $this->resource['place_id'],
            'kind' => $this->resource['kind'],
        ];
    }
}
