<?php

namespace App\Http\Resources;

use App\Models\SecurityAlert;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * One alert card in the Security alerts panel (Framer mQcXDCyDZ).
 * Plain facts only; the screen turns them into words ("5 failed sign-ins in 2 minutes").
 *
 * @mixin SecurityAlert
 */
class SecurityAlertResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'type' => $this->type,
            'severity' => $this->severity,
            'status' => $this->status,
            'subject_email' => $this->subject_email,
            'ip_address' => $this->ip_address,
            'device' => $this->device,
            'event_count' => $this->event_count,
            'first_seen_at' => $this->first_seen_at?->toIso8601String(),
            'last_seen_at' => $this->last_seen_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
            'account' => $this->user ? [
                'id' => $this->user->id,
                'full_name' => $this->user->full_name,
                'role' => $this->user->role,
            ] : null,
            'reviewed_by' => $this->reviewer ? ['id' => $this->reviewer->id, 'full_name' => $this->reviewer->full_name] : null,
            'reviewed_at' => $this->reviewed_at?->toIso8601String(),
        ];
    }
}
