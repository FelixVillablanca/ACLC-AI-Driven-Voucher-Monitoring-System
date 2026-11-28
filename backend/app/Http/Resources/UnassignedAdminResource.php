<?php

namespace App\Http\Resources;

use App\Domain\Identity\Queries\UnassignedAdmins;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * One Admin with no company yet, in the "Admin in charge" picker of "+ Add company".
 *   status: 'pending' (hasn't set a password / signed in yet) | 'active'
 *   removed_at: when the account is removed unless given a company (24 h after it was made)
 */
class UnassignedAdminResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'full_name' => $this->full_name,
            'email' => $this->email,
            'status' => $this->accountStatus(),
            'created_at' => $this->created_at?->toIso8601String(),
            'removed_at' => UnassignedAdmins::deadlineFor($this->resource)?->toIso8601String(),
        ];
    }
}
