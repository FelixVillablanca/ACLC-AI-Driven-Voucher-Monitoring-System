<?php

namespace App\Http\Resources\Admin;

use App\Models\Department;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * One department in the Admin search dropdown.
 *
 * @mixin Department
 */
class AdminSearchDepartmentResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'code' => $this->code,
            'is_active' => (bool) $this->is_active,
            'users_count' => (int) $this->users_count,
            'head' => $this->head?->full_name,
        ];
    }
}
