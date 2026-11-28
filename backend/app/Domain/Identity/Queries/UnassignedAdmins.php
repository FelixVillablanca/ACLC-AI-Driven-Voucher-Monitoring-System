<?php

namespace App\Domain\Identity\Queries;

use App\Models\User;
use Closure;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Carbon;

/**
 * Admins with "No company yet" (since 2026-11-28 Add admin may leave the company empty) who can be given one:
 * the "Admin in charge" picker of "+ Add company". Deactivated or refused accounts are left out.
 * The same rule is used to show the list and to check the pick when saving (CreateCompany).
 *
 * They have GRACE_HOURS (24 h from when the account was made) to get a company (user decision 2026-11-28); after that
 * ExpireUnassignedAdmins removes the account (deleted if it was never used, otherwise deactivated).
 */
class UnassignedAdmins
{
    public const GRACE_HOURS = 24;

    /** The Super Admins are warned this long before the account is removed. */
    public const WARN_HOURS = 3;

    public static function query(): Builder
    {
        return User::query()
            ->where('role', 'admin')
            ->whereNull('company_id')
            ->where('is_active', true)
            ->where('access_status', '!=', 'rejected');
    }

    /** Validation rule: the id must be one of these Admins (+ Add company, the company panel). */
    public static function rule(): Closure
    {
        return function (string $attribute, mixed $value, Closure $fail) {
            if (! self::query()->whereKey($value)->exists()) {
                $fail('This Admin already has a company or is no longer active. Pick another one.');
            }
        };
    }

    /** When this Admin is removed unless given a company (null when it doesn't apply to them). */
    public static function deadlineFor(User $user): ?Carbon
    {
        if ($user->role !== 'admin' || $user->company_id !== null || ! $user->is_active || ! $user->created_at) {
            return null;
        }

        return $user->created_at->copy()->addHours(self::GRACE_HOURS);
    }

    /** A–Z, at most 200 (a picker, not a directory). */
    public function list(?string $search = null): Collection
    {
        $like = $search === null ? null : '%'.addcslashes($search, '%_\\').'%';

        return self::query()
            ->when($like, fn (Builder $q) => $q->where(fn (Builder $q) => $q
                ->whereRaw("CONCAT(first_name, ' ', last_name) LIKE ?", [$like])
                ->orWhere('email', 'like', $like)))
            ->orderBy('first_name')->orderBy('last_name')->orderBy('id')
            ->limit(200)
            ->get(['id', 'role', 'company_id', 'first_name', 'last_name', 'email', 'is_active', 'access_status', 'last_login_at', 'created_at']);
    }
}
