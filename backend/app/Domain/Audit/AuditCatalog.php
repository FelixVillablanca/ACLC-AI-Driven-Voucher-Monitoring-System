<?php

namespace App\Domain\Audit;

/**
 * EVERY KIND OF AUDIT ENTRY the system writes, in one list (Audit logs tab, Framer EJ0asP2ZH):
 *   label      what people read ("User role changed")
 *   group      the AL4 action filter groups (Sign-in & security, Users & access, …)
 *   tone       pill colour: primary | success | warning | danger | neutral
 *   sensitive  the amber ⚑: changes to who can do what, global rules, company status, exports, blocks
 *
 * When a new feature writes a new `action`, add it here. An action that isn't listed still shows
 * (its name made readable, group "Other").
 */
class AuditCatalog
{
    public const GROUPS = [
        'security' => 'Sign-in & security',
        'users' => 'Users & access',
        'settings' => 'Settings & companies',
        'vouchers' => 'Vouchers',
        'system' => 'System jobs',
    ];

    /** @var array<string, array{label: string, group: string, tone: string, sensitive?: bool}> */
    public const ACTIONS = [
        // Sign-in & security
        'login' => ['label' => 'Signed in', 'group' => 'security', 'tone' => 'neutral'],
        'login_failed' => ['label' => 'Sign-in failed', 'group' => 'security', 'tone' => 'danger', 'sensitive' => true],
        'login_blocked' => ['label' => 'Sign-in refused (blocked IP)', 'group' => 'security', 'tone' => 'danger', 'sensitive' => true],
        'password_set_by_admin' => ['label' => 'Password set by Admin', 'group' => 'security', 'tone' => 'warning', 'sensitive' => true],
        'password_set' => ['label' => 'Password set', 'group' => 'security', 'tone' => 'success'],
        'password_reset_sent' => ['label' => 'Password reset sent', 'group' => 'security', 'tone' => 'warning', 'sensitive' => true],
        'password_reset_completed' => ['label' => 'Password changed', 'group' => 'security', 'tone' => 'warning'],
        'two_factor_enabled' => ['label' => 'Two-step turned on', 'group' => 'security', 'tone' => 'success'],
        'two_factor_required' => ['label' => 'Two-step required', 'group' => 'security', 'tone' => 'warning', 'sensitive' => true],
        'two_factor_failed' => ['label' => 'Two-step code wrong', 'group' => 'security', 'tone' => 'danger'],
        'two_factor_recovery_code_used' => ['label' => 'Backup code used', 'group' => 'security', 'tone' => 'warning'],
        'two_factor_setup_postponed' => ['label' => 'Two-step set up later', 'group' => 'security', 'tone' => 'neutral'],
        'two_factor_disabled' => ['label' => 'Two-step turned off', 'group' => 'security', 'tone' => 'danger', 'sensitive' => true],
        'two_factor_recovery_codes_renewed' => ['label' => 'New backup codes made', 'group' => 'security', 'tone' => 'neutral'],
        'password_changed' => ['label' => 'Password changed (signed in)', 'group' => 'security', 'tone' => 'warning'],
        'session_signed_out' => ['label' => 'Signed out a device', 'group' => 'security', 'tone' => 'neutral'],
        'sessions_signed_out' => ['label' => 'Signed out other devices', 'group' => 'security', 'tone' => 'neutral'],
        'security_alert_reviewed' => ['label' => 'Security alert reviewed', 'group' => 'security', 'tone' => 'neutral'],
        'security_alert_dismissed' => ['label' => 'Security alert dismissed', 'group' => 'security', 'tone' => 'neutral'],
        'security_alerts_reviewed_all' => ['label' => 'All security alerts reviewed', 'group' => 'security', 'tone' => 'neutral'],
        'ip_blocked' => ['label' => 'IP address blocked', 'group' => 'security', 'tone' => 'danger', 'sensitive' => true],
        'ip_unblocked' => ['label' => 'IP address unblocked', 'group' => 'security', 'tone' => 'warning', 'sensitive' => true],

        // Users & access
        'created' => ['label' => 'Account created', 'group' => 'users', 'tone' => 'primary', 'sensitive' => true],
        'updated' => ['label' => 'Account details changed', 'group' => 'users', 'tone' => 'primary', 'sensitive' => true],
        'profile_updated' => ['label' => 'Own profile changed', 'group' => 'users', 'tone' => 'primary'],
        'role_changed' => ['label' => 'User role changed', 'group' => 'users', 'tone' => 'primary', 'sensitive' => true],
        'invitation_sent' => ['label' => 'Invitation sent', 'group' => 'users', 'tone' => 'neutral'],
        'invitation_cancelled' => ['label' => 'Invitation cancelled', 'group' => 'users', 'tone' => 'warning', 'sensitive' => true],
        'account_deactivated' => ['label' => 'Account deactivated', 'group' => 'users', 'tone' => 'danger', 'sensitive' => true],
        'account_reactivated' => ['label' => 'Account reactivated', 'group' => 'users', 'tone' => 'success', 'sensitive' => true],
        'access_granted' => ['label' => 'Company access granted', 'group' => 'users', 'tone' => 'primary', 'sensitive' => true],
        'access_invited' => ['label' => 'Invited to a company', 'group' => 'users', 'tone' => 'primary'],
        'access_invite_cancelled' => ['label' => 'Invitation withdrawn', 'group' => 'users', 'tone' => 'neutral'],
        'access_invite_accepted' => ['label' => 'Invitation accepted', 'group' => 'users', 'tone' => 'success', 'sensitive' => true],
        'access_invite_declined' => ['label' => 'Invitation declined', 'group' => 'users', 'tone' => 'neutral'],
        'access_requested' => ['label' => 'Asked to join a company', 'group' => 'users', 'tone' => 'primary'],
        'access_request_cancelled' => ['label' => 'Join request withdrawn', 'group' => 'users', 'tone' => 'neutral'],
        'access_request_approved' => ['label' => 'Join request approved', 'group' => 'users', 'tone' => 'success', 'sensitive' => true],
        'access_request_declined' => ['label' => 'Join request declined', 'group' => 'users', 'tone' => 'neutral'],
        'access_revoked' => ['label' => 'Company access removed', 'group' => 'users', 'tone' => 'warning', 'sensitive' => true],
        'admins_exported' => ['label' => 'Admin list exported', 'group' => 'users', 'tone' => 'neutral', 'sensitive' => true],

        // Settings & companies
        'setting_changed' => ['label' => 'Global setting changed', 'group' => 'settings', 'tone' => 'primary', 'sensitive' => true],
        'defaults_applied' => ['label' => 'Platform defaults applied', 'group' => 'settings', 'tone' => 'neutral'],
        'catalog_created' => ['label' => 'Catalog item added', 'group' => 'settings', 'tone' => 'success'],
        'catalog_updated' => ['label' => 'Catalog item changed', 'group' => 'settings', 'tone' => 'primary'],
        'catalog_deleted' => ['label' => 'Catalog item deleted', 'group' => 'settings', 'tone' => 'warning'],
        'catalog_deactivated' => ['label' => 'Category deactivated', 'group' => 'settings', 'tone' => 'warning'],
        'catalog_reactivated' => ['label' => 'Category reactivated', 'group' => 'settings', 'tone' => 'success'],
        'department_created' => ['label' => 'Department added', 'group' => 'settings', 'tone' => 'success'],
        'department_updated' => ['label' => 'Department changed', 'group' => 'settings', 'tone' => 'primary'],
        'department_deactivated' => ['label' => 'Department deactivated', 'group' => 'settings', 'tone' => 'warning', 'sensitive' => true],
        'department_reactivated' => ['label' => 'Department reactivated', 'group' => 'settings', 'tone' => 'success'],
        'company_created' => ['label' => 'Company added', 'group' => 'settings', 'tone' => 'success', 'sensitive' => true],
        'company_suspended' => ['label' => 'Company suspended', 'group' => 'settings', 'tone' => 'danger', 'sensitive' => true],
        'company_reactivated' => ['label' => 'Company reactivated', 'group' => 'settings', 'tone' => 'success', 'sensitive' => true],
        'companies_exported' => ['label' => 'Company list exported', 'group' => 'settings', 'tone' => 'neutral', 'sensitive' => true],
        'audit_exported' => ['label' => 'Audit log exported', 'group' => 'settings', 'tone' => 'neutral', 'sensitive' => true],

        // Vouchers (Phase 3–4 write these; amounts are never shown to the Super Admin)
        'voucher_created' => ['label' => 'Voucher created', 'group' => 'vouchers', 'tone' => 'neutral'],
        'voucher_updated' => ['label' => 'Voucher changed', 'group' => 'vouchers', 'tone' => 'neutral'],
        'voucher_submitted' => ['label' => 'Voucher submitted', 'group' => 'vouchers', 'tone' => 'primary'],
        'voucher_approved' => ['label' => 'Voucher approved', 'group' => 'vouchers', 'tone' => 'success'],
        'voucher_rejected' => ['label' => 'Voucher rejected', 'group' => 'vouchers', 'tone' => 'danger'],
        'voucher_returned' => ['label' => 'Voucher returned', 'group' => 'vouchers', 'tone' => 'warning'],
        'voucher_cancelled' => ['label' => 'Voucher cancelled', 'group' => 'vouchers', 'tone' => 'neutral'],
        'voucher_draft_deleted' => ['label' => 'Draft deleted', 'group' => 'vouchers', 'tone' => 'warning'],
        'voucher_draft_expired' => ['label' => 'Old draft deleted (30 days)', 'group' => 'vouchers', 'tone' => 'neutral'],

        // System jobs
        'backup_started' => ['label' => 'Backup started', 'group' => 'system', 'tone' => 'neutral'],
        'failed_jobs_retried' => ['label' => 'Failed jobs retried', 'group' => 'system', 'tone' => 'neutral'],
        'failed_jobs_deleted' => ['label' => 'Failed jobs deleted', 'group' => 'system', 'tone' => 'warning', 'sensitive' => true],
        'incident_resolved' => ['label' => 'Incident resolved', 'group' => 'system', 'tone' => 'success'],
    ];

    /** Fields whose VALUES are never shown or exported here: money (no voucher access) and secrets. */
    private const HIDDEN_FIELD = '/amount|price|budget|spend|total|password|secret|token|recovery/i';

    public static function describe(string $action): array
    {
        $known = self::ACTIONS[$action] ?? null;

        return [
            'key' => $action,
            'label' => $known['label'] ?? ucfirst(str_replace('_', ' ', $action)),
            'group' => $known['group'] ?? 'other',
            'tone' => $known['tone'] ?? 'neutral',
            'sensitive' => (bool) ($known['sensitive'] ?? false),
        ];
    }

    /** @return array<int, string> */
    public static function sensitiveActions(): array
    {
        return array_keys(array_filter(self::ACTIONS, fn ($a) => $a['sensitive'] ?? false));
    }

    /** @return array<int, string> */
    public static function actionsIn(string $group): array
    {
        return array_keys(array_filter(self::ACTIONS, fn ($a) => $a['group'] === $group));
    }

    /** The AL4 dropdown: [{ key, label, actions: [{ key, label }] }] */
    public static function groups(): array
    {
        return collect(self::GROUPS)->map(fn ($label, $key) => [
            'key' => $key,
            'label' => $label,
            'actions' => collect(self::actionsIn($key))->map(fn ($a) => ['key' => $a, 'label' => self::ACTIONS[$a]['label']])->values()->all(),
        ])->values()->all();
    }

    /** Values with money and secrets replaced by "hidden" (recursively). */
    public static function redact(mixed $values): mixed
    {
        if (! is_array($values)) {
            return $values;
        }
        foreach ($values as $key => $value) {
            $values[$key] = is_string($key) && preg_match(self::HIDDEN_FIELD, $key)
                ? '(hidden)'
                : self::redact($value);
        }

        return $values;
    }
}
