<?php

namespace App\Http\Resources;

use App\Domain\Audit\AuditDescriber;
use App\Domain\Identity\Support\AccountActions;
use App\Domain\Identity\Support\RoleEmailDomains;
use App\Domain\Reporting\Queries\SuperAdminDashboardSummary;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * The profile side panel (Admins tab A8, Framer lsRiMKhBC) and the Edit / Make Super Admin
 * dialogs (A9, A12): everything in the row, plus details, security facts, the company,
 * recent activity, why a menu item is greyed out, and the promotion checklist.
 *
 * @mixin User
 */
class AdminAccountDetailResource extends AdminAccountResource
{
    private const RECENT_ACTIVITY = 5;

    public function toArray(Request $request): array
    {
        $viewer = $request->user();
        $lastLogin = DB::table('audit_logs')->where('action', 'login')->where('user_id', $this->id)
            ->latest('id')->first(['created_at', 'ip_address', 'new_values']);
        $created = DB::table('audit_logs')->where('action', 'created')->where('table_name', 'users')
            ->where('record_id', $this->id)->oldest('id')->first(['user_id', 'created_at']);
        $passwordChanged = DB::table('audit_logs')->where('table_name', 'users')->where('record_id', $this->id)
            ->whereIn('action', ['password_set', 'password_reset_completed'])->latest('id')->value('created_at');

        $activity = DB::table('audit_logs')->where('user_id', $this->id)->latest('id')->limit(self::RECENT_ACTIVITY)->get();

        return [
            ...parent::toArray($request),
            'employee_id' => $this->employee_id,
            'company' => $this->company ? [
                'id' => $this->company->id,
                'name' => $this->company->name,
                'users_count' => User::where('company_id', $this->company->id)->count(),
            ] : null,
            'created_by' => $created?->user_id ? User::find($created->user_id)?->full_name : null,
            'last_sign_in' => $lastLogin ? [
                'at' => Carbon::parse($lastLogin->created_at)->toIso8601String(),
                'device' => json_decode($lastLogin->new_values ?? '{}', true)['device'] ?? null,
                'ip' => $lastLogin->ip_address,
            ] : null,
            'password_changed_at' => $passwordChanged ? Carbon::parse($passwordChanged)->toIso8601String() : null,
            'failed_sign_ins_30d' => DB::table('audit_logs')->where('action', 'login_failed')
                ->where('created_at', '>=', now()->subDays(30))
                ->where(fn ($q) => $q->where('user_id', $this->id)->orWhere('new_values->email', strtolower($this->email)))
                ->count(),
            'two_factor_details' => [
                'confirmed_at' => $this->two_factor_confirmed_at?->toIso8601String(),
                'required_at' => $this->two_factor_required_at?->toIso8601String(),
                'setup_deadline' => $this->two_factor_setup_deadline?->toIso8601String(),
                'recovery_codes_left' => $this->hasTwoFactor() ? count($this->two_factor_recovery_codes ?? []) : null,
            ],
            'recent_activity' => app(AuditDescriber::class)->describeMany($activity),
            // Why a menu item / button is greyed out (null = allowed)
            'action_notes' => $viewer ? collect(AccountActions::ACTIONS)
                ->mapWithKeys(fn ($a) => [$a => AccountActions::reason($viewer, $this->resource, $a)])->all() : [],
            'promotion' => $this->role === 'admin' ? [
                'seats_used' => AccountActions::seatsUsed(),
                'seats_total' => SuperAdminDashboardSummary::SUPER_ADMIN_SEATS,
                'new_email' => RoleEmailDomains::emailFor(strstr($this->email, '@', true), 'super_admin'),
                'checks' => AccountActions::promotionChecks($this->resource),
                // Would their company be left with no working Admin?
                'company_left_without_admin' => $this->company_id !== null && ! User::where('role', 'admin')
                    ->where('company_id', $this->company_id)->where('is_active', true)->whereKeyNot($this->id)->exists(),
            ] : null,
        ];
    }
}
