<?php

namespace App\Http\Resources;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * One person on the company side panel's Users tab (C8). No passwords, no two-step secrets.
 *
 * @mixin User
 */
class CompanyMemberResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'full_name' => $this->full_name,
            'email' => $this->email,
            'role' => $this->role,
            'status' => $this->accountStatus(),
            'two_factor' => $this->twoFactorStatus() === 'on',
            'department' => $this->department?->name,
            // home = this is their own company; access = they were given access to it
            // (the company is the one in the address: /companies/{company}/users)
            'membership' => (int) $this->company_id === (int) $request->route('company')?->id ? 'home' : 'access',
            'last_login_at' => $this->last_login_at?->toIso8601String(),
        ];
    }
}
