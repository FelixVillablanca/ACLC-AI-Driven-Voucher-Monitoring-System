<?php

namespace App\Http\Resources;

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
     * Only Admin accounts can be locked/reset here: Super Admins are protected (seat rules),
     * and clerks/officers/supervisors belong to their company's Admin.
     */
    private function actions(): array
    {
        $user = $this->user;
        $open = $this->status === 'open';

        $blocked = match (true) {
            $user === null => 'No account uses this email, so there is nothing to lock or reset.',
            $user->role === 'super_admin' => 'Super Admin accounts can’t be locked or reset from here.',
            $user->role !== 'admin' => 'This is a company user. Their company’s Admin manages the account.',
            default => null,
        };

        $resetBlocked = $blocked ?? match (true) {
            $user->access_status === 'pending' => 'They haven’t set a password yet.',
            ! $user->personal_email => 'This Admin has no personal email to send the link to.',
            default => null,
        };

        return [
            'review' => $open,
            'dismiss' => $open,
            'lock' => $blocked === null && $user->is_active,
            'unlock' => $blocked === null && ! $user->is_active,
            'reset_password' => $resetBlocked === null,
            'account_note' => $blocked,
            'reset_note' => $blocked === null ? $resetBlocked : null,
        ];
    }
}
