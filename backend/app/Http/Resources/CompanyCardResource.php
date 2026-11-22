<?php

namespace App\Http\Resources;

use App\Domain\Tenancy\Queries\CompanyDirectory;
use App\Models\Company;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Carbon;

/**
 * One company card / list row on the Super Admin's Companies tab (Framer vnNFYExpX, C4).
 * Counts and dates only, never money. Load it through CompanyDirectory::withCardData().
 *
 * @mixin Company
 */
class CompanyCardResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        $admin = $this->relationLoaded('admins') ? $this->admins->first() : null;
        $lastActivity = $this->last_activity_at ? Carbon::parse($this->last_activity_at) : null;

        return [
            'id' => $this->id,
            'name' => $this->name,
            'type' => $this->type,
            'address' => $this->address,
            // active | suspended | inactive (switched off without a suspension, e.g. older data)
            'status' => $this->isSuspended() ? 'suspended' : ($this->is_active ? 'active' : 'inactive'),
            'is_new' => $this->created_at?->gt(now()->subDays(CompanyDirectory::NEW_FOR_DAYS)) ?? false,
            'users_count' => (int) ($this->users_count ?? 0),
            'departments_count' => (int) ($this->departments_count ?? 0),
            'last_activity_at' => $lastActivity?->toIso8601String(),
            'admin' => $admin ? ['id' => $admin->id, 'full_name' => $admin->full_name, 'is_active' => $admin->is_active] : null,
            'suspension' => $this->isSuspended() ? [
                'at' => $this->suspended_at->toIso8601String(),
                'reason' => $this->suspension_reason,
                'by' => $this->suspendedBy ? ['id' => $this->suspendedBy->id, 'full_name' => $this->suspendedBy->full_name] : null,
                'by_you' => $this->suspended_by === $request->user()?->id,
            ] : null,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
