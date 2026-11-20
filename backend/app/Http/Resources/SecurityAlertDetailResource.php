<?php

namespace App\Http\Resources;

use App\Domain\Identity\Support\AccountActions;
use App\Domain\Security\Actions\WatchSignIns;
use App\Models\SecurityAlert;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * The Alert detail panel (Framer SCoT_cu7B): everything on the card, plus the account,
 * "What happened", the facts behind "Suggested next step", and which buttons may be used.
 *
 * @mixin SecurityAlert
 */
class SecurityAlertDetailResource extends SecurityAlertResource
{
    public function toArray(Request $request): array
    {
        return [
            ...parent::toArray($request),
            'rule' => $this->type === SecurityAlert::TYPE_FAILED_SIGN_INS
                ? ['failures' => WatchSignIns::FAILED_LIMIT, 'minutes' => WatchSignIns::FAILED_WINDOW_MINUTES]
                : null,
            'events' => $this->details['events'] ?? [],
            'ip_seen_before' => $this->ipSeenBefore(),
            'account' => $this->user ? $this->account($this->user) : null,
            'actions' => $this->actions(),
        ];
    }

    private function account(User $user): array
    {
        $lastLogin = DB::table('audit_logs')->where('action', 'login')->where('user_id', $user->id)
            ->latest('id')->first(['created_at', 'ip_address', 'new_values']);

        return [
            'id' => $user->id,
            'full_name' => $user->full_name,
            'first_name' => $user->first_name,
            'last_name' => $user->last_name,
            'personal_email' => $user->personal_email, // where a reset link would go
            'role' => $user->role,
            'email' => $user->email,
            'company' => $user->company?->name,
            'status' => match (true) {
                ! $user->is_active => 'locked',
                $user->access_status === 'pending' => 'pending',
                default => 'active',
            },
            'last_good_sign_in' => $lastLogin ? [
                'at' => Carbon::parse($lastLogin->created_at)->toIso8601String(),
                'ip' => $lastLogin->ip_address,
                'device' => json_decode($lastLogin->new_values ?? '{}', true)['device'] ?? null,
            ] : ($user->last_login_at ? ['at' => $user->last_login_at->toIso8601String(), 'ip' => null, 'device' => null] : null),
        ];
    }

    /** Has this account ever signed in successfully from the alert's IP? (null = can't tell) */
    private function ipSeenBefore(): ?bool
    {
        if ($this->type === SecurityAlert::TYPE_NEW_DEVICE) {
            return $this->details['ip_seen_before'] ?? null;
        }
        if (! $this->user_id || ! $this->ip_address) {
            return null;
        }

        return DB::table('audit_logs')->where('action', 'login')->where('user_id', $this->user_id)
            ->where('ip_address', $this->ip_address)->where('created_at', '<', $this->first_seen_at ?? now())->exists();
    }

    /**
     * Which footer buttons work, and if not, why (shown as a note instead).
     * The same rules as the Admins tab (AccountActions): Admins and Super Admins can be
     * deactivated / reset (never yourself, never the last Super Admin); company users belong
     * to their company's Admin.
     */
    private function actions(): array
    {
        $user = $this->user;
        $viewer = request()->user();
        $open = $this->status === 'open';

        if ($user === null || ! in_array($user->role, ['admin', 'super_admin'], true)) {
            return [
                'review' => $open, 'dismiss' => $open, 'deactivate' => false, 'reactivate' => false, 'reset_password' => false,
                'account_note' => $user === null
                    ? 'No account uses this email, so there is nothing to deactivate or reset.'
                    : 'This is a company user. Their company’s Admin manages the account.',
                'reset_note' => null,
            ];
        }

        $deactivate = AccountActions::reason($viewer, $user, $user->is_active ? 'deactivate' : 'reactivate');
        $reset = AccountActions::reason($viewer, $user, 'reset_password');

        return [
            'review' => $open,
            'dismiss' => $open,
            'deactivate' => $user->is_active && $deactivate === null,
            'reactivate' => ! $user->is_active && $deactivate === null,
            'reset_password' => $reset === null,
            // Only say something when the main action is blocked
            'account_note' => $user->is_active && $deactivate !== null ? $deactivate : null,
            'reset_note' => $user->is_active ? $reset : null,
        ];
    }
}
