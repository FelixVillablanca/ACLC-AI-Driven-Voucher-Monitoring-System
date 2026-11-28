<?php

namespace App\Domain\Identity\Support;

use App\Domain\Reporting\Queries\SuperAdminDashboardSummary;
use App\Exceptions\ApiException;
use App\Models\User;

/**
 * THE RULES for what a Super Admin may do to an Admin / Super Admin account.
 * ONE place, used three ways:
 *   - the Admins table and profile panel (which menu items show, and why one is greyed out)
 *   - the Security alert detail (Reset password / Deactivate)
 *   - every action itself (so the server refuses even if someone calls the API directly)
 *
 * reason() returns null when allowed, otherwise a sentence to show.
 */
class AccountActions
{
    public const ACTIONS = [
        'edit', 'resend_invitation', 'cancel_invitation', 'reset_password',
        'require_two_factor', 'make_super_admin', 'deactivate', 'reactivate', 'assign_company',
    ];

    /** "Signed in within the last 30 days" (A12 Make Super Admin checklist). */
    public const PROMOTION_RECENT_SIGN_IN_DAYS = 30;

    /** @return array<string, bool> e.g. ['edit' => true, 'deactivate' => false, …] */
    public static function allowed(User $actor, User $target): array
    {
        $out = [];
        foreach (self::ACTIONS as $action) {
            $out[$action] = self::reason($actor, $target, $action) === null;
        }

        return $out;
    }

    /** Throws 409 (or 404 for accounts this area doesn't manage) when not allowed. */
    public static function authorize(User $actor, User $target, string $action): void
    {
        if (! in_array($target->role, ['admin', 'super_admin'], true)) {
            throw new ApiException('We could not find what you are looking for.', 'NOT_FOUND', 404);
        }
        if ($reason = self::reason($actor, $target, $action)) {
            throw new ApiException($reason, 'ACTION_NOT_ALLOWED', 409);
        }
    }

    public static function reason(User $actor, User $target, string $action): ?string
    {
        $isAdmin = $target->role === 'admin';
        $isSuper = $target->role === 'super_admin';
        $isYou = $actor->id === $target->id;
        $pending = $target->access_status === 'pending';

        if (! $isAdmin && ! $isSuper) {
            return 'This is a company user. Their company’s Admin manages the account.';
        }

        return match ($action) {
            'edit' => $isAdmin ? null : 'Super Admin details are changed from the server console for now.',

            'resend_invitation' => match (true) {
                ! $isAdmin || ! $pending => 'Only Admins who haven’t set a password yet get invitations.',
                ! $target->is_active => 'Reactivate the account first.',
                ! $target->personal_email => 'This Admin has no personal email to send the link to.',
                default => null,
            },

            'cancel_invitation' => match (true) {
                ! $isAdmin || ! $pending => 'Only an invitation that was never used can be cancelled.',
                $target->last_login_at !== null => 'They already signed in. Deactivate the account instead.',
                default => null,
            },

            'reset_password' => match (true) {
                $isYou => 'Change your own password from your account menu.',
                $pending => 'They haven’t set a password yet. Resend their invitation instead.',
                ! $target->is_active => 'Reactivate the account first.',
                ! $target->personal_email => 'There is no personal email to send the link to.',
                default => null,
            },

            'require_two_factor' => match (true) {
                $target->hasTwoFactor() => 'Two-step sign-in is already on.',
                $target->mustSetUpTwoFactor() => 'Two-step is already required; they’ll set it up at their next sign-in.',
                $pending => 'They haven’t set a password yet.',
                ! $target->is_active => 'Reactivate the account first.',
                default => null,
            },

            'make_super_admin' => match (true) {
                ! $isAdmin => 'They’re already a Super Admin.',
                self::seatsUsed() >= SuperAdminDashboardSummary::SUPER_ADMIN_SEATS => 'All '.SuperAdminDashboardSummary::SUPER_ADMIN_SEATS.' Super Admin seats are taken.',
                default => null, // the detailed checklist is in promotionChecks()
            },

            'deactivate' => match (true) {
                $isYou => 'You can’t deactivate your own account.',
                ! $target->is_active => 'The account is already deactivated.',
                $isSuper && self::seatsUsed() <= 1 => 'This is the last active Super Admin. Add another one first.',
                default => null,
            },

            'reactivate' => match (true) {
                $target->is_active => 'The account is already active.',
                $isAdmin && $target->company_id === null => 'Give them a company first (Edit details): an Admin with no company is removed automatically.',
                $isSuper && self::seatsUsed() >= SuperAdminDashboardSummary::SUPER_ADMIN_SEATS => 'All Super Admin seats are taken.',
                default => null,
            },

            // Admins tab "Assign to a company" (2026-11-28): only an active Admin with no company yet
            'assign_company' => match (true) {
                ! $isAdmin => 'Super Admins work outside every company.',
                $target->company_id !== null => 'They already run a company. Use Edit details to move them.',
                ! $target->is_active || $target->access_status === 'rejected' => 'Deactivated accounts can’t be given a company here. Use Edit details, then reactivate.',
                default => null,
            },

            default => 'Unknown action.',
        };
    }

    /**
     * A12 "Before you can continue" checklist: [{ key, ok, label }]. All ok = promotion allowed.
     *
     * @return array<int, array{key: string, ok: bool, label: string}>
     */
    public static function promotionChecks(User $target): array
    {
        $recent = $target->last_login_at?->gt(now()->subDays(self::PROMOTION_RECENT_SIGN_IN_DAYS)) ?? false;

        return [
            ['key' => 'active', 'ok' => $target->is_active && $target->access_status === 'accepted', 'label' => 'Account is active'],
            ['key' => 'recent_sign_in', 'ok' => $recent, 'label' => 'Signed in within the last '.self::PROMOTION_RECENT_SIGN_IN_DAYS.' days'],
            ['key' => 'two_factor', 'ok' => $target->hasTwoFactor(), 'label' => $target->hasTwoFactor()
                ? 'Two-step sign-in is on'
                : 'Two-step sign-in is off. Every Super Admin must use it.'],
        ];
    }

    /** Active Super Admins. Counted once per request (the table asks for every row). */
    public static function seatsUsed(): int
    {
        $attributes = request()->attributes;
        if (! $attributes->has('super_admin_seats_used')) {
            $attributes->set('super_admin_seats_used', User::where('role', 'super_admin')->where('is_active', true)->count());
        }

        return $attributes->get('super_admin_seats_used');
    }

    /** After an action changed the count (deactivate / reactivate / promote). */
    public static function forgetSeats(): void
    {
        request()->attributes->remove('super_admin_seats_used');
    }
}
