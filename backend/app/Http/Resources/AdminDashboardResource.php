<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * The admin dashboard numbers, wrapped as { "data": { ... } } like every other response.
 * The summary is already a plain array (built by AdminDashboardSummary), so this
 * Resource just passes it through. Keeping it means the response shape has
 * ONE place to change if the dashboard grows.
 */
class AdminDashboardResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return $this->resource;
    }
}
