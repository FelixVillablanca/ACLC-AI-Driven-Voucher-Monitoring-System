<?php

namespace App\Http\Resources;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * API RESOURCE = decides exactly which fields of a User leave the server.
 * The password hash and remember_token are NEVER listed here, so they can
 * never leak, even by accident.
 *
 * @mixin User
 */
class UserResource extends JsonResource
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
            'profile_photo' => $this->profile_photo,
            'last_login_at' => $this->last_login_at?->toIso8601String(),
            'company' => CompanySummaryResource::make($this->whenLoaded('company')),
            'department' => $this->whenLoaded('department', fn () => $this->department ? [
                'id' => $this->department->id,
                'name' => $this->department->name,
            ] : null),
            // The companies this user may switch between (only approved, active ones)
            'companies' => CompanySummaryResource::collection($this->whenLoaded('accessibleCompanies')),
        ];
    }
}
