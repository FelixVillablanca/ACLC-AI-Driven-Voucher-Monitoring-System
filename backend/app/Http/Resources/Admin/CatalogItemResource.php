<?php

namespace App\Http\Resources\Admin;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * One item of a Categories-page list (a category, voucher type or payee type).
 *   built_in = a category every company sees (company_id NULL): read-only for Admins
 *   vouchers_count = how many vouchers use it (a used item can't be deleted)
 */
class CatalogItemResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        $isCategory = array_key_exists('is_active', $this->resource->getAttributes());

        return [
            'id' => $this->id,
            'name' => $this->name,
            'code' => $this->when($isCategory, fn () => $this->code),
            'description' => $this->when($isCategory, fn () => $this->description),
            'is_active' => $isCategory ? (bool) $this->is_active : true,
            'built_in' => $this->company_id === null,
            'vouchers_count' => (int) ($this->vouchers_count ?? 0),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
