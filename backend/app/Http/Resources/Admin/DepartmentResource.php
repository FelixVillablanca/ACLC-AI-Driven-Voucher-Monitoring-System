<?php

namespace App\Http\Resources\Admin;

use App\Models\Department;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * A department, as the Admin screens show it.
 * people_count is present on list rows (DepartmentDirectory::withRowData).
 *
 * @mixin Department
 */
class DepartmentResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'code' => $this->code,
            'description' => $this->description,
            'is_active' => (bool) $this->is_active,
            'head' => $this->head ? [
                'id' => $this->head->id,
                'full_name' => $this->head->full_name,
                'is_active' => (bool) ($this->head->is_active ?? true),
            ] : null,
            'people_count' => $this->when(isset($this->people_count), fn () => (int) $this->people_count),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(), // sent back when saving an edit (409 if it changed)
        ];
    }
}
