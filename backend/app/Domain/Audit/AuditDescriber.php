<?php

namespace App\Domain\Audit;

use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

/**
 * Turns raw audit_logs rows into short sentences for people:
 *   { action: "created", table_name: "users", new_values: {first_name: "Maria"…} }  →  "Created a user: Maria Lopez"
 * Used by the profile panel's "Recent activity" / "Activity" tab (Admins tab A8).
 * `sensitive` marks the ⚑ entries (changes to other people's access).
 */
class AuditDescriber
{
    private const SENSITIVE = [
        'role_changed', 'account_deactivated', 'account_reactivated', 'password_reset_sent',
        'two_factor_required', 'invitation_cancelled', 'access_changed', 'admins_exported',
    ];

    /** @param  Collection<int, object>  $rows  audit_logs rows */
    public function describeMany(Collection $rows): array
    {
        // Names of the people the rows are about, in one query
        $userIds = $rows->where('table_name', 'users')->pluck('record_id')->filter()->unique();
        $names = User::whereIn('id', $userIds)->get(['id', 'first_name', 'last_name'])->keyBy('id');

        return $rows->map(fn ($row) => $this->describe($row, $names))->values()->all();
    }

    private function describe(object $row, Collection $names): array
    {
        $new = json_decode($row->new_values ?? 'null', true) ?? [];
        $old = json_decode($row->old_values ?? 'null', true) ?? [];
        $who = $names->get($row->record_id)?->full_name
            ?? trim(($new['first_name'] ?? $old['name'] ?? '').' '.($new['last_name'] ?? ''))
            ?: 'someone';

        $text = match ([$row->action, $row->table_name]) {
            ['login', 'users'] => 'Signed in'.(isset($new['device']) ? ' · '.$new['device'] : ''),
            ['login_failed', 'users'] => 'Failed sign-in',
            ['created', 'users'] => "Created an account for {$who}",
            ['updated', 'users'] => "Changed {$who}'s details",
            ['role_changed', 'users'] => "Changed {$who}'s role".(isset($new['role']) ? ' to '.Str::headline($new['role']) : ''),
            ['password_set', 'users'] => 'Set their password',
            ['password_reset_completed', 'users'] => 'Chose a new password',
            ['password_reset_sent', 'users'] => "Sent {$who} a password reset",
            ['invitation_sent', 'users'] => "Sent {$who} an invitation",
            ['invitation_cancelled', 'users'] => "Cancelled the invitation for {$who}",
            ['account_deactivated', 'users'] => "Deactivated {$who}'s account",
            ['account_reactivated', 'users'] => "Reactivated {$who}'s account",
            ['two_factor_enabled', 'users'] => 'Turned on two-step sign-in',
            ['two_factor_required', 'users'] => "Required two-step sign-in for {$who}",
            ['two_factor_failed', 'users'] => 'Typed a wrong two-step code',
            ['two_factor_disabled', 'users'] => 'Turned off two-step sign-in',
            ['two_factor_recovery_codes_renewed', 'users'] => 'Made new backup codes',
            ['two_factor_recovery_code_used', 'users'] => 'Signed in with a backup code',
            ['two_factor_setup_postponed', 'users'] => 'Chose to set up two-step sign-in later',
            ['password_changed', 'users'] => 'Changed their password',
            ['profile_updated', 'users'] => 'Updated their profile ('.implode(', ', array_map(fn ($f) => str_replace('_', ' ', $f), array_keys($new))).')',
            ['session_signed_out', 'users'] => 'Signed out '.($new['device'] ?? 'a device'),
            ['sessions_signed_out', 'users'] => 'Signed out all other devices',
            ['login_blocked', 'users'] => 'Sign-in refused (blocked address)',
            ['admins_exported', 'users'] => 'Exported the admin list',
            ['backup_started', 'backups'] => 'Started a database backup',
            default => Str::ucfirst(str_replace('_', ' ', $row->action)).' · '.str_replace('_', ' ', $row->table_name),
        };

        return [
            'id' => $row->id,
            'text' => $text,
            'sensitive' => in_array($row->action, self::SENSITIVE, true),
            'at' => Carbon::parse($row->created_at)->toIso8601String(),
            'ip_address' => $row->ip_address,
        ];
    }
}
