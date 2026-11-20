<?php

namespace App\Http\Resources;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * One row of the Admin accounts table (Framer bxGFPLOVN).
 * `actions` says which ⋯ menu items work for this row, so the screen never offers
 * something the server would refuse.
 *
 * @mixin User
 */
class AdminAccountResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $status = $this->accountStatus();
        $isAdmin = $this->role === 'admin';
        $isYou = $this->id === $request->user()?->id;

        return [
            'id' => $this->id,
            'first_name' => $this->first_name,
            'last_name' => $this->last_name,
            'full_name' => $this->full_name,
            'email' => $this->email,
            'personal_email' => $this->personal_email,
            'role' => $this->role,
            'company' => $this->company?->name,
            'status' => $status,
            'is_you' => $isYou,
            'last_login_at' => $this->last_login_at?->toIso8601String(),
            'deactivated_at' => $this->deactivated_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
            // Super Admin accounts are only managed from the server console for now
            'actions' => [
                'resend_invitation' => $isAdmin && $this->is_active && $this->access_status === 'pending' && $this->personal_email !== null,
                'reset_password' => $isAdmin && $this->is_active && $this->access_status === 'accepted' && $this->personal_email !== null,
                'lock' => $isAdmin && $this->is_active,
                'unlock' => $isAdmin && ! $this->is_active,
            ],
        ];
    }
}
