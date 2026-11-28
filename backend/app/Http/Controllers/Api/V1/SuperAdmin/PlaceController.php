<?php

namespace App\Http\Controllers\Api\V1\SuperAdmin;

use App\Domain\Platform\Geocoding\Nominatim;
use App\Http\Controllers\Controller;
use App\Http\Requests\SuperAdmin\ReversePlaceRequest;
use App\Http\Requests\SuperAdmin\SearchPlacesRequest;
use App\Http\Resources\PlaceResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * The company map pin's address search (OpenStreetMap, 2026-11-28). Thin: the rules of the free service
 * (1 request a second, cache, app name) live in Nominatim. 503 GEOCODER_UNAVAILABLE when it doesn't answer.
 */
class PlaceController extends Controller
{
    public function __construct(private readonly Nominatim $places) {}

    /** GET /superadmin/places/search?q=  → up to 5 places, best first ([] = nothing found). */
    public function search(SearchPlacesRequest $request): AnonymousResourceCollection
    {
        return PlaceResource::collection($this->places->search($request->validated('q')));
    }

    /** GET /superadmin/places/reverse?lat=&lng=  → { data: place | null } (null = no address at that spot). */
    public function reverse(ReversePlaceRequest $request): JsonResponse|PlaceResource
    {
        $place = $this->places->reverse((float) $request->validated('lat'), (float) $request->validated('lng'));

        return $place ? new PlaceResource($place) : response()->json(['data' => null]);
    }
}
