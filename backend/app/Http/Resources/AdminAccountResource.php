<?php

namespace App\Http\Resources;

use App\Domain\Identity\Actions\SendAccountInvitation;
use App\Domain\Identity\Support\AccountActions;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * One row of the Admins table (Framer U7glXUOSF).
 * `actions` says which ⋯ menu items work for this row (rules: AccountActions), so the screen
 * never offers something the server would refuse.
 *
 * @mixin User
 */
class AdminAccountResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $viewer = $request->user();

        return [
            'id' => $this->id,
            'first_name' => $this->first_name,
            'last_name' => $this->last_name,
            'full_name' => $this->full_name,
            'email' => $this->email,
            'personal_email' => $this->personal_email,
            'role' => $this->role,
            'company' => $this->company?->name,
            'status' => $this->accountStatus(),
            'two_factor' => $this->twoFactorStatus(),
            'two_factor_setup_deadline' => $this->two_factor_setup_deadline?->toIso8601String(),
            'is_you' => $this->id === $viewer?->id,
            'last_login_at' => $this->last_login_at?->toIso8601String(),
            'deactivated_at' => $this->deactivated_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
            // Pending Admins: when their "set your password" link stops working
            'invitation_expires_at' => $this->access_status === 'pending' ? $this->invitationExpiresAt() : null,
            'actions' => $viewer ? AccountActions::allowed($viewer, $this->resource) : [],
        ];
    }

    private function invitationExpiresAt(): ?string
    {
        $created = DB::table('password_reset_tokens')->where('email', $this->email)->value('created_at');
        $hours = intdiv((int) config('auth.passwords.'.SendAccountInvitation::BROKER.'.expire'), 60);

        return $created ? Carbon::parse($created)->addHours($hours)->toIso8601String() : null;
    }
}
