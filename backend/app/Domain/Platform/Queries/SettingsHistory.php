<?php

namespace App\Domain\Platform\Queries;

use App\Domain\Platform\SystemSettings;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * QUERY CLASS for "Change history" (Framer G1 OtA4G9A9F): every saved change to the global settings,
 * newest first, from the audit log (append-only, so the history can't be edited).
 *   setting_changed   one row per setting a Super Admin changed (old → new + reason)
 *   defaults_applied  the "System · Platform defaults applied" entry (SystemSettingsSeeder)
 */
class SettingsHistory
{
    public function __construct(private SystemSettings $settings) {}

    private function base(?string $group = null): Builder
    {
        return DB::table('audit_logs')
            ->where('audit_logs.table_name', 'system_settings')
            ->whereIn('audit_logs.action', ['setting_changed', 'defaults_applied'])
            // a section filter shows only that section's changes (the System entry is in "All")
            ->when($group, fn (Builder $q) => $q->where('audit_logs.action', 'setting_changed')
                ->whereRaw("JSON_UNQUOTE(JSON_EXTRACT(audit_logs.new_values, '$.group')) = ?", [$group]));
    }

    /** The numbers on the filter tabs: [all => 18, approval => 4, …] */
    public function counts(): array
    {
        $byGroup = $this->base()
            ->where('audit_logs.action', 'setting_changed')
            ->selectRaw("JSON_UNQUOTE(JSON_EXTRACT(audit_logs.new_values, '$.group')) as grp, COUNT(*) as n")
            ->groupBy('grp')->pluck('n', 'grp');

        return ['all' => $this->base()->count(), ...collect(SystemSettings::GROUPS)
            ->mapWithKeys(fn ($g) => [$g => (int) ($byGroup[$g] ?? 0)])->all()];
    }

    public function page(?string $group, int $perPage = 10): LengthAwarePaginator
    {
        $page = $this->base($group)
            ->leftJoin('users', 'users.id', '=', 'audit_logs.user_id')
            ->orderByDesc('audit_logs.created_at')->orderByDesc('audit_logs.id')
            ->select(['audit_logs.id', 'audit_logs.action', 'audit_logs.old_values', 'audit_logs.new_values', 'audit_logs.created_at',
                'audit_logs.user_id', 'users.first_name', 'users.last_name'])
            ->paginate($perPage);

        // the newest change of each setting: "↺ Restore" is offered there, while it's still the live value
        $latestIds = DB::table('audit_logs')
            ->where('table_name', 'system_settings')->where('action', 'setting_changed')
            ->selectRaw("JSON_UNQUOTE(JSON_EXTRACT(new_values, '$.key')) as k, MAX(id) as id")
            ->groupBy('k')->pluck('id', 'k');
        $current = $this->settings->all();

        return $page->through(function ($row) use ($latestIds, $current) {
            $old = json_decode((string) $row->old_values, true);
            $new = json_decode((string) $row->new_values, true);
            $key = $new['key'] ?? null;

            return [
                'id' => $row->id,
                'action' => $row->action,
                'at' => Carbon::parse($row->created_at)->toIso8601String(),
                'by' => $row->user_id ? [
                    'id' => $row->user_id,
                    'full_name' => trim("{$row->first_name} {$row->last_name}") ?: 'A removed account',
                    'first_name' => $row->first_name,
                    'last_name' => $row->last_name,
                ] : null, // null = the system
                'key' => $key,
                'group' => $new['group'] ?? null,
                'old' => $old['value'] ?? null,
                'new' => $row->action === 'setting_changed' ? ($new['value'] ?? null) : null,
                'reason' => $new['reason'] ?? null,
                // defaults_applied: which settings got their starting value
                'defaults' => $row->action === 'defaults_applied' ? array_keys((array) $new) : null,
                'can_restore' => $key !== null
                    && (int) ($latestIds[$key] ?? 0) === (int) $row->id
                    && array_key_exists($key, $current)
                    && $current[$key] === ($new['value'] ?? null)
                    && ($old['value'] ?? null) !== null,
            ];
        });
    }
}
