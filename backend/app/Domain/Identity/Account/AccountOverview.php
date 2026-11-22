<?php

namespace App\Domain\Identity\Account;

use App\Domain\Platform\SystemSettings;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * "My profile" + "Account settings": everything the signed-in person may see about THEIR OWN account.
 * (The Super Admin's view of someone else is AdminAccountDetailResource; this one is self-service.)
 *
 * Read-only: changes go through UpdateOwnProfile, ChangeOwnPassword, OwnTwoFactor and OwnSessions.
 */
class AccountOverview
{
    public function __construct(private OwnSessions $sessions) {}

    public function for(User $user, string $currentSessionId): array
    {
        $user->loadMissing(['company', 'department']);

        $lastLogins = DB::table('audit_logs')->where('action', 'login')->where('user_id', $user->id)
            ->latest('id')->limit(2)->get(['created_at', 'ip_address', 'new_values']);
        // [0] is the sign-in that started THIS visit; [1] is the one before it ("last time you signed in")
        $previous = $lastLogins->get(1);

        $created = DB::table('audit_logs')->where('table_name', 'users')->where('record_id', $user->id)
            ->whereIn('action', ['created'])->oldest('id')->first(['user_id', 'created_at']);

        $passwordChanged = DB::table('audit_logs')->where('table_name', 'users')->where('record_id', $user->id)
            ->whereIn('action', ['password_set', 'password_reset_completed', 'password_changed'])
            ->latest('id')->value('created_at');

        return [
            'id' => $user->id,
            'employee_id' => $user->employee_id,
            'first_name' => $user->first_name,
            'last_name' => $user->last_name,
            'full_name' => $user->full_name,
            'email' => $user->email,
            'personal_email' => $user->personal_email,
            'role' => $user->role,
            'company' => $user->company ? ['id' => $user->company->id, 'name' => $user->company->name] : null,
            'department' => $user->department ? ['id' => $user->department->id, 'name' => $user->department->name] : null,
            'member_since' => ($created?->created_at ? Carbon::parse($created->created_at) : $user->created_at)?->toIso8601String(),
            'created_by' => $created?->user_id ? User::find($created->user_id)?->full_name : null,
            'previous_sign_in' => $previous ? [
                'at' => Carbon::parse($previous->created_at)->toIso8601String(),
                'ip' => $previous->ip_address,
                'device' => json_decode($previous->new_values ?? '{}', true)['device'] ?? null,
            ] : null,
            'password_changed_at' => $passwordChanged ? Carbon::parse($passwordChanged)->toIso8601String() : null,
            // Failed sign-ins with this email in 30 days: "was that you?"
            'failed_sign_ins_30d' => DB::table('audit_logs')->where('action', 'login_failed')
                ->where('created_at', '>=', now()->subDays(30))
                ->where(fn ($q) => $q->where('user_id', $user->id)->orWhere('new_values->email', strtolower($user->email)))
                ->count(),
            'two_factor' => [
                'status' => $user->twoFactorStatus(), // on | required | off
                'confirmed_at' => $user->two_factor_confirmed_at?->toIso8601String(),
                'setup_deadline' => $user->mustSetUpTwoFactor() ? $user->two_factor_setup_deadline?->toIso8601String() : null,
                'recovery_codes_left' => $user->hasTwoFactor() ? count($user->two_factor_recovery_codes ?? []) : null,
                // Why "Turn off" is greyed out (null = they may turn it off)
                'turn_off_blocked' => $user->hasTwoFactor() ? OwnTwoFactor::whyCantTurnOff($user) : null,
            ],
            'sessions_count' => count($this->sessions->list($user, $currentSessionId)),
            // Super Admins: no "keep me signed in", and they're signed out after the idle timeout (Global settings)
            'idle_timeout_minutes' => $user->role === 'super_admin'
                ? (int) app(SystemSettings::class)->value(SystemSettings::SUPER_ADMIN_IDLE_TIMEOUT)
                : null,
        ];
    }
}
