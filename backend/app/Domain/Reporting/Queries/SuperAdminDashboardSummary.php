<?php

namespace App\Domain\Reporting\Queries;

use App\Domain\Platform\SystemHealth;
use App\Domain\Platform\SystemSettings;
use App\Models\Company;
use App\Models\SecurityAlert;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;

/**
 * QUERY CLASS for the Super Admin landing page (Framer uH0wO9f5O, "redesign v2").
 * It only READS. Everything is counted by the database, across the WHOLE platform.
 *
 * What it deliberately leaves out: anything about vouchers or money. The Super Admin
 * has no voucher access (docs/System_Flow_Roles_and_UML_Design.docx §4.4), so not
 * even a total amount leaves the server.
 */
class SuperAdminDashboardSummary
{
    /** The platform allows 1 to 3 Super Admins (spec §4.2). */
    public const SUPER_ADMIN_SEATS = 3;

    /** How many admin accounts the landing page lists ("Manage →" opens the full list). */
    private const ADMIN_LIST_LIMIT = 5;

    public function __construct(
        private SystemHealth $health,
        private SystemSettings $settings,
    ) {}

    /** @return array<string, mixed> */
    public function get(User $viewer): array
    {
        $services = $this->health->services();

        return [
            'checked_at' => now()->toIso8601String(),
            'counts' => $this->counts(),
            'services' => $services,
            'attention' => $this->attention(collect($services)->keyBy('key')->all()),
            'admins' => $this->admins(),
            'rules' => $this->rules(),
        ];
    }

    /** The 4 KPI tiles. */
    private function counts(): array
    {
        $admins = User::where('role', 'admin');

        return [
            'admins' => [
                'total' => (clone $admins)->count(),
                'active' => (clone $admins)->where('is_active', true)->count(),
                'inactive' => (clone $admins)->where('is_active', false)->count(),
            ],
            'super_admins' => [
                'active' => User::where('role', 'super_admin')->where('is_active', true)->count(),
                'seats' => self::SUPER_ADMIN_SEATS,
            ],
            'companies' => [
                'total' => Company::count(),
                'active' => Company::where('is_active', true)->count(),
                'suspended' => Company::whereNotNull('suspended_at')->count(),
            ],
            // Everyone who works in or sets up a company (Super Admins aren't counted)
            'users' => ['total' => User::where('role', '!=', 'super_admin')->count()],
        ];
    }

    /**
     * "Needs your attention": real problems only, most serious first. Each row has a `type`;
     * the screen decides the words, icon and button.
     *
     * @param  array<string, array<string, mixed>>  $services
     * @return array<int, array<string, mixed>>
     */
    private function attention(array $services): array
    {
        $items = [];

        $backup = $services['backup'];
        // `running` lets the row say "Backing up now…" instead of offering a second backup
        if ($backup['status'] === 'danger') {
            $items[] = ['type' => 'backup_overdue', 'severity' => 'danger', 'last_success_at' => $backup['last_success_at'], 'running' => $backup['running']];
        } elseif ($backup['status'] === 'not_configured') {
            $items[] = ['type' => 'backup_missing', 'severity' => 'danger', 'running' => $backup['running']];
        }

        if ($services['ml']['status'] === 'danger') {
            $items[] = ['type' => 'ml_down', 'severity' => 'danger'];
        }

        $failed = $services['queue']['failed'];
        if ($failed > 0) {
            $items[] = ['type' => 'failed_jobs', 'severity' => 'warning', 'count' => $failed, 'jobs' => $this->health->failedJobNames()];
        }

        // Shared security alerts not reviewed yet (Security alerts panel, Framer mQcXDCyDZ).
        // Red when one of them is High (e.g. many failed sign-ins), amber otherwise.
        $alerts = SecurityAlert::open();
        $alertCount = (clone $alerts)->count();
        if ($alertCount > 0) {
            $latest = (clone $alerts)->latest('id')->first(['type', 'subject_email']);
            $items[] = [
                'type' => 'security_alerts',
                'severity' => (clone $alerts)->where('severity', 'high')->exists() ? 'danger' : 'warning',
                'count' => $alertCount,
                'latest' => ['type' => $latest->type, 'subject_email' => $latest->subject_email],
            ];
        }

        foreach (Company::whereNotNull('suspended_at')->orderByDesc('suspended_at')->limit(3)->get() as $company) {
            $items[] = [
                'type' => 'company_suspended',
                'severity' => 'info',
                'company' => ['id' => $company->id, 'name' => $company->name],
                'suspended_at' => Carbon::parse($company->suspended_at)->toIso8601String(),
                'users_affected' => $this->usersOf($company->id),
            ];
        }

        return $items;
    }

    /** People whose home company is this one, or who were given access to it. */
    private function usersOf(int $companyId): int
    {
        return User::where('role', '!=', 'super_admin')
            ->where(fn (Builder $q) => $q
                ->where('company_id', $companyId)
                ->orWhereHas('accessibleCompanies', fn (Builder $c) => $c
                    ->where('companies.id', $companyId)
                    ->where('user_company_access.granted_status', 'accepted')))
            ->count();
    }

    /**
     * A few admin accounts: working ones first (newest sign-in first), deactivated ones last.
     * status: active | pending (never signed in yet) | inactive (deactivated)
     *
     * @return array<int, array<string, mixed>>
     */
    private function admins(): array
    {
        return User::where('role', 'admin')
            ->with('company:id,name')
            ->orderByDesc('is_active')
            ->orderByRaw('COALESCE(last_login_at, created_at) DESC')
            ->orderByDesc('id')
            ->limit(self::ADMIN_LIST_LIMIT)
            ->get(['id', 'first_name', 'last_name', 'email', 'is_active', 'access_status', 'last_login_at', 'deactivated_at', 'created_at', 'company_id'])
            ->map(fn (User $admin) => [
                'id' => $admin->id,
                'first_name' => $admin->first_name,
                'last_name' => $admin->last_name,
                'full_name' => $admin->full_name,
                'email' => $admin->email,
                'company' => $admin->company?->name,
                'status' => $admin->accountStatus(), // same rule as the Admins page
                'last_login_at' => $admin->last_login_at?->toIso8601String(),
                'deactivated_at' => $admin->deactivated_at?->toIso8601String(),
                'created_at' => $admin->created_at?->toIso8601String(),
            ])
            ->all();
    }

    /** The "Global rules" strip. null = not set yet. */
    private function rules(): array
    {
        return [
            'high_value_threshold' => $this->settings->get(SystemSettings::HIGH_VALUE_THRESHOLD),
            'anomaly_sensitivity' => $this->settings->get(SystemSettings::ANOMALY_SENSITIVITY),
            'openai' => [
                'monthly_cap_usd' => $this->settings->get(SystemSettings::OPENAI_MONTHLY_CAP_USD),
                'spent_this_month_usd' => null, // not tracked until the OpenAI summaries exist (Phase 5)
            ],
            // What's really enforced right now for everyone else (config/session.php, SESSION_LIFETIME)
            'session_lifetime_minutes' => (int) config('session.lifetime'),
            // Super Admins are signed out sooner when idle (EnforceIdleTimeout)
            'super_admin_idle_timeout_minutes' => (int) $this->settings->get(
                SystemSettings::SUPER_ADMIN_IDLE_TIMEOUT,
                SystemSettings::DEFAULTS[SystemSettings::SUPER_ADMIN_IDLE_TIMEOUT]['value'],
            ),
            'last_change' => $this->settings->lastChange(),
        ];
    }
}
