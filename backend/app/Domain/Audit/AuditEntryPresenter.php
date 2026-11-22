<?php

namespace App\Domain\Audit;

use App\Domain\Platform\SystemSettings;
use App\Domain\Security\Support\DeviceLabel;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Turns raw audit_logs rows into what the Audit logs table shows (Framer EJ0asP2ZH):
 * WHO (person, "System" or "Unknown · Not signed in"), the ACTION pill, the RECORD it was about
 * ("Maria Lopez · users #48"), the company, the IP, and WHAT CHANGED (old → new).
 * Money and secrets are always replaced by "(hidden)": the Super Admin has no voucher access.
 */
class AuditEntryPresenter
{
    private const ROLE_LABELS = [
        'super_admin' => 'Super Admin', 'admin' => 'Admin', 'accounting_clerk' => 'Accounting Clerk',
        'accounting_officer' => 'Accounting Officer', 'supervisor_manager' => 'Supervisor',
    ];

    /** One line under a sensitive entry, saying why it matters. */
    private const NOTES = [
        'role_changed' => 'A role change gives this person different powers. The email domain follows the role.',
        'setting_changed' => 'Global settings apply to every company.',
        'company_suspended' => 'Nobody in this company can sign in until it is reactivated.',
        'account_deactivated' => 'This person can no longer sign in.',
        'access_granted' => 'This person can now work in another company.',
        'ip_blocked' => 'Sign-ins from this address are refused for every company.',
        'login_failed' => 'Repeated failures from one address can mean someone is guessing passwords.',
    ];

    /** @var array<int, string> users.id => full name, for the records the entries are about */
    private array $people = [];

    /** @var array<int, string> companies.id => name */
    private array $companies = [];

    public function __construct(private ?int $viewerId = null) {}

    /** Look up, in two queries, the names of every person / company the rows are about. */
    public function prime(Collection $rows): static
    {
        $userIds = $rows->where('table_name', 'users')->pluck('record_id')->filter()->unique();
        $this->people = DB::table('users')->whereIn('id', $userIds)
            ->selectRaw("id, TRIM(CONCAT(first_name, ' ', last_name)) as name")->pluck('name', 'id')->all();

        $companyIds = $rows->where('table_name', 'companies')->pluck('record_id')->filter()->unique();
        $this->companies = DB::table('companies')->whereIn('id', $companyIds)->pluck('name', 'id')->all();

        return $this;
    }

    public function row(object $r): array
    {
        $old = AuditCatalog::redact(json_decode((string) $r->old_values, true));
        $new = AuditCatalog::redact(json_decode((string) $r->new_values, true));
        $action = AuditCatalog::describe($r->action);

        return [
            'id' => $r->id,
            'at' => Carbon::parse($r->created_at)->toIso8601String(),
            'action' => $action,
            'who' => $this->who($r),
            'record' => $this->record($r, (array) $old, (array) $new),
            'company' => $r->company_id ? ['id' => (int) $r->company_id, 'name' => $r->company_name ?? "companies #{$r->company_id}"] : null,
            'ip' => $r->ip_address,
            'changes' => $this->changes((array) $old, (array) $new, $r->action),
            'request_id' => $r->request_id ?? null,
            'browser' => DeviceLabel::from($r->user_agent),
            'note' => $action['sensitive'] ? (self::NOTES[$r->action] ?? null) : null,
        ];
    }

    private function who(object $r): array
    {
        if ($r->user_id) {
            $name = trim(($r->user_first_name ?? '').' '.($r->user_last_name ?? '')) ?: 'A removed account';

            return [
                'kind' => 'person',
                'id' => (int) $r->user_id,
                'name' => $name,
                'first_name' => $r->user_first_name ?? null,
                'last_name' => $r->user_last_name ?? null,
                'email' => $r->user_email ?? null,
                'role' => self::ROLE_LABELS[$r->user_role ?? ''] ?? null,
                'is_you' => $this->viewerId !== null && (int) $r->user_id === $this->viewerId,
            ];
        }

        // nobody signed in: a failed / refused sign-in is a stranger, anything else is the system itself
        return in_array($r->action, ['login_failed', 'login_blocked'], true)
            ? ['kind' => 'unknown', 'name' => 'Unknown', 'role' => 'Not signed in']
            : ['kind' => 'system', 'name' => 'System', 'role' => $r->table_name === 'backups' ? 'Scheduled job' : 'Automatic'];
    }

    /** ["title" => what it was about, "subtitle" => table #id or a short detail] */
    private function record(object $r, array $old, array $new): array
    {
        $id = $r->record_id;
        $ref = $id ? "{$r->table_name} #{$id}" : $r->table_name;

        return match (true) {
            in_array($r->action, ['login_failed', 'login_blocked'], true) => [
                'title' => $new['email'] ?? 'Unknown email',
                'subtitle' => match (true) {
                    $r->action === 'login_blocked' => 'Refused: this address is blocked',
                    ($new['reason'] ?? null) === 'unknown_email' => 'No such account',
                    default => 'Wrong password',
                },
            ],
            $r->action === 'login' => ['title' => 'Signed in', 'subtitle' => $new['device'] ?? DeviceLabel::from($r->user_agent) ?? $ref],
            $r->table_name === 'users' => ['title' => $this->people[$id] ?? ($new['email'] ?? $ref), 'subtitle' => $ref],
            $r->table_name === 'companies' => ['title' => $id ? ($this->companies[$id] ?? $ref) : 'Company list', 'subtitle' => $ref],
            $r->table_name === 'system_settings' => [
                'title' => isset($new['key']) ? (SystemSettings::DEFAULTS[$new['key']]['label'] ?? $new['key']) : 'Global settings',
                'subtitle' => $ref,
            ],
            $r->table_name === 'backups' => ['title' => 'Database backup', 'subtitle' => isset($new['trigger']) ? ucfirst($new['trigger']) : $ref],
            $r->table_name === 'failed_jobs' => ['title' => ($new['count'] ?? '?').' background job(s)', 'subtitle' => 'failed_jobs'],
            $r->table_name === 'blocked_ips' => ['title' => $new['ip_address'] ?? $old['ip_address'] ?? 'IP address', 'subtitle' => $ref],
            $r->table_name === 'audit_logs' => ['title' => 'Audit log export', 'subtitle' => isset($new['count']) ? "{$new['count']} rows" : 'audit_logs'],
            str_starts_with($r->table_name, 'voucher') => ['title' => $new['voucher_number'] ?? $ref, 'subtitle' => 'Amounts hidden from Super Admin'],
            default => ['title' => $ref, 'subtitle' => null],
        };
    }

    /** [{ field, old, new }] for the "What changed" box (only fields that really changed). */
    private function changes(array $old, array $new, string $action): array
    {
        // a sign-in's "values" are details about it, not a change
        if (in_array($action, ['login', 'login_failed', 'login_blocked'], true)) {
            return collect($new)->except(['email'])->map(fn ($v, $k) => ['field' => $k, 'old' => null, 'new' => self::text($v)])->values()->all();
        }

        $fields = array_unique([...array_keys($old), ...array_keys($new)]);
        $out = [];
        foreach ($fields as $field) {
            if (in_array($field, ['key', 'group'], true)) {
                continue; // which setting it was is already in the Record column
            }
            $before = array_key_exists($field, $old) ? self::text($old[$field]) : null;
            $after = array_key_exists($field, $new) ? self::text($new[$field]) : null;
            if ($before !== $after) {
                $out[] = ['field' => $field, 'old' => $before, 'new' => $after];
            }
        }

        return $out;
    }

    private static function text(mixed $v): ?string
    {
        return match (true) {
            $v === null => null,
            is_bool($v) => $v ? 'true' : 'false',
            is_array($v) => json_encode($v, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            default => (string) $v,
        };
    }
}
