<?php

namespace App\Http\Resources\Admin;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * One person in the "Grant company access" list.
 * access = none (never asked) | pending (waiting) | denied (refused before)
 *
 * @mixin User
 */
class AccessCandidateResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'first_name' => $this->first_name,
            'last_name' => $this->last_name,
            'full_name' => $this->full_name,
            'email' => $this->email,
            'employee_id' => $this->employee_id,
            'role' => $this->role,
            'department' => $this->department?->name,
            'access' => $this->access_status_for_company ?? 'none',
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
