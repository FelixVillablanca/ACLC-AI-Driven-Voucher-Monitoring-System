<?php

namespace App\Domain\Identity\Support;

use App\Exceptions\ApiException;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * "Is this account still allowed in?" ONE rule, used in TWO places:
 *   1. at sign-in (AuthenticateUser), so a blocked person can't start a session
 *   2. on every later request (EnsureAccountInGoodStanding middleware), so someone who is
 *      ALREADY signed in is signed out on their very next click, not hours later
 *
 * Blocked when:
 *   - the account is deactivated or not approved               -> 403 ACCOUNT_INACTIVE
 *     (an invited Admin who hasn't set a password yet is "pending" and gets a clearer message)
 *   - an ADMIN whose company is suspended or inactive           -> 403 COMPANY_SUSPENDED
 *     (since 2026-11-20 each Admin runs ONE company; the user chose "blocked too")
 *   - (clerk / officer / supervisor) EVERY company they work in -> 403 COMPANY_SUSPENDED
 *     is suspended or inactive (Framer eGUijf8Wd: "Nobody in this company will be able to sign in")
 *
 * Not blocked by a suspension:
 *   - someone who also works in another, active company: they keep working there,
 *     and the suspended company simply disappears from their company list (/auth/me)
 *   - Super Admins: they run the whole platform
 */
final class AccountStanding
{
    private const OPERATIONAL_ROLES = ['accounting_clerk', 'accounting_officer', 'supervisor_manager'];

    public static function problem(User $user): ?ApiException
    {
        // Invited but no password chosen yet (an open "set your password" link exists)
        if ($user->is_active && $user->access_status === 'pending'
            && DB::table('password_reset_tokens')->where('email', $user->email)->exists()) {
            return new ApiException(
                'Your account isn’t set up yet. Use the link in your invitation email to choose a password.',
                'ACCOUNT_INACTIVE',
                403,
            );
        }

        if (! $user->is_active || $user->access_status !== 'accepted') {
            return new ApiException(
                'Your account is not active. Please contact your system administrator.',
                'ACCOUNT_INACTIVE',
                403,
            );
        }

        $blocked = match (true) {
            $user->role === 'admin' => self::homeCompanyInactive($user),
            in_array($user->role, self::OPERATIONAL_ROLES, true) => self::allCompaniesSuspended($user),
            default => false,
        };

        if ($blocked) {
            return new ApiException(
                'Your company’s account is suspended, so you can’t sign in right now. Please contact your administrator.',
                'COMPANY_SUSPENDED',
                403,
            );
        }

        return null;
    }

    /** An Admin's one company (users.company_id) exists but is suspended / inactive. */
    private static function homeCompanyInactive(User $user): bool
    {
        return $user->company_id !== null
            && $user->company()->where('is_active', false)->exists();
    }

    /**
     * True when the user HAS company access, but none of those companies is active.
     * (A user with no access at all isn't "suspended"; that is a setup gap the Admin dashboard already shows.)
     */
    private static function allCompaniesSuspended(User $user): bool
    {
        $access = $user->accessibleCompanies()->wherePivot('granted_status', 'accepted');

        return (clone $access)->exists() && ! (clone $access)->where('companies.is_active', true)->exists();
    }
}
