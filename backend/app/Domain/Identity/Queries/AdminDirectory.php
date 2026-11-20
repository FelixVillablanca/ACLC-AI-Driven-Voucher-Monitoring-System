<?php

namespace App\Domain\Identity\Queries;

use App\Domain\Identity\Support\AccountActions;
use App\Domain\Reporting\Queries\SuperAdminDashboardSummary;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

/**
 * QUERY CLASS for the Admins tab (Framer U7glXUOSF) and its Export (A1): the same filters,
 * views and sort, so "export this view" exports exactly what's on screen.
 *
 * "Needs attention" (the amber summary card, and the "Needs attention first" sort) =
 *   a pending account (invited, password not set), OR an active account without two-step sign-in.
 */
class AdminDirectory
{
    /** Everyone who runs the system (never company users). */
    public const ROLES = ['admin', 'super_admin'];

    /** All accounts matching the search. */
    public function base(?string $search = null): Builder
    {
        $search = trim((string) $search);
        // % and _ are wildcards in LIKE; escape them so they match themselves
        $like = '%'.addcslashes($search, '\\%_').'%';

        return User::query()
            ->whereIn('role', self::ROLES)
            ->when($search !== '', fn (Builder $q) => $q->where(fn (Builder $w) => $w
                ->whereRaw("CONCAT_WS(' ', first_name, last_name) LIKE ?", [$like])
                ->orWhere('email', 'like', $like)));
    }

    /** The segmented views: All / Super Admins / Admins / Pending / Inactive. */
    public function view(Builder $query, ?string $view): Builder
    {
        return match ($view) {
            'super_admins' => $query->where('role', 'super_admin'),
            'admins' => $query->where('role', 'admin'),
            'pending' => $query->withAccountStatus('pending'),
            'inactive' => $query->withAccountStatus('inactive'),
            default => $query,
        };
    }

    /** A4 sort menu. Ties are always broken by name, then id, so pages never shuffle. */
    public function sort(Builder $query, string $sort = 'last_sign_in', string $order = 'desc'): Builder
    {
        $dir = $order === 'asc' ? 'asc' : 'desc';

        match ($sort) {
            'name' => $query->orderBy('first_name', $dir === 'desc' ? 'desc' : 'asc')->orderBy('last_name', $dir === 'desc' ? 'desc' : 'asc'),
            'role' => $query->orderByRaw("role = 'super_admin' DESC")->orderBy('first_name'),
            'attention' => $query->orderByRaw('('.self::needsAttentionSql().') DESC')->orderByRaw('last_login_at IS NULL, last_login_at '.$dir),
            'created' => $query->orderBy('created_at', $dir),
            // Last sign-in: never-signed-in accounts go last
            default => $query->orderByRaw('last_login_at IS NULL')->orderBy('last_login_at', $dir),
        };

        return $query->orderBy('first_name')->orderBy('id');
    }

    /** The numbers on the view tabs (they follow the search). */
    public function viewCounts(?string $search): array
    {
        $counts = ['all' => $this->base($search)->count()];
        foreach (['super_admins', 'admins', 'pending', 'inactive'] as $view) {
            $counts[$view] = $this->view($this->base($search), $view)->count();
        }

        return $counts;
    }

    /** The 4 summary cards (always the whole list, not the search). */
    public function summary(): array
    {
        $all = $this->base();

        return [
            'total_accounts' => (clone $all)->count(),
            'super_admin_seats' => ['used' => AccountActions::seatsUsed(), 'total' => SuperAdminDashboardSummary::SUPER_ADMIN_SEATS],
            // "Two-step sign-in on 3 of 5": out of everyone who has finished setting up their account
            'two_factor' => [
                'on' => (clone $all)->whereNotNull('two_factor_confirmed_at')->count(),
                'of' => (clone $all)->where('access_status', '!=', 'pending')->count(),
            ],
            'needs_attention' => (clone $all)->whereRaw(self::needsAttentionSql())->count(),
        ];
    }

    public static function needsAttentionSql(): string
    {
        return "(access_status = 'pending' OR (is_active = 1 AND access_status = 'accepted' AND two_factor_confirmed_at IS NULL))";
    }
}
