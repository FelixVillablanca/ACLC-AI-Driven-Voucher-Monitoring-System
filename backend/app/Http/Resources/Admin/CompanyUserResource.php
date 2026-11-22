<?php

namespace App\Http\Resources\Admin;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * One clerk / officer / supervisor on the Admin's Users page. Never the password or tokens.
 *
 * @mixin User
 */
class CompanyUserResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'employee_id' => $this->employee_id,
            'first_name' => $this->first_name,
            'last_name' => $this->last_name,
            'full_name' => $this->full_name,
            'email' => $this->email,
            'role' => $this->role,
            'status' => $this->accountStatus(), // active | pending | inactive
            'department' => $this->department ? [
                'id' => $this->department->id,
                'name' => $this->department->name,
                'code' => $this->department->code,
                'is_active' => (bool) $this->department->is_active,
            ] : null,
            'two_factor' => (bool) $this->two_factor_confirmed_at,
            'last_login_at' => $this->last_login_at?->toIso8601String(),
            'deactivated_at' => $this->deactivated_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(), // sent back when saving an edit (409 if it changed)
        ];
    }
}
