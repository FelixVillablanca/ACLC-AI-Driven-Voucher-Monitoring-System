<?php

namespace App\Http\Resources\Admin;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * One person in the Admin search dropdown. Only what the row shows.
 *
 * @mixin User
 */
class AdminSearchUserResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'full_name' => $this->full_name,
            'email' => $this->email,
            'employee_id' => $this->employee_id,
            'role' => $this->role,
            'status' => $this->accountStatus(), // active | pending | inactive
            'department' => $this->department?->name,
        ];
    }
}
