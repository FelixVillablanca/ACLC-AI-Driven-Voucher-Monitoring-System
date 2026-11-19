<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * The Super Admin landing-page numbers, wrapped as { "data": { ... } }.
 * SuperAdminDashboardSummary already picks exactly which fields leave the server
 * (no voucher data, no passwords), so this passes its array through.
 */
class SuperAdminDashboardResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return $this->resource;
    }
}
