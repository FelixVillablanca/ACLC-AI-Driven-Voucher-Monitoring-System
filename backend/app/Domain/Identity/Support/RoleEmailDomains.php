<?php

namespace App\Domain\Identity\Support;

/**
 * Each role has its OWN email domain (CLAUDE.md "Domain emails", rule set 2026-11-16):
 *
 *   super_admin         -> {name}@Superadmin.com  (created only by `php artisan superadmin:create`)
 *   admin               -> {name}@Administrator.com
 *   accounting_clerk    -> {name}@Clerk.com
 *   accounting_officer  -> {name}@Officer.com
 *   supervisor_manager  -> {name}@Supervisor.com
 *
 * The admin only types the {name} part; the server builds the full address from
 * the role, so the domain can never be changed or faked. Domains keep their
 * capital first letter; the name part is stored in lower case.
 *
 * Emails are compared WITHOUT caring about upper/lower case (the database column
 * uses a case-insensitive collation), so signing in with "maria@clerk.com" still works.
 */
final class RoleEmailDomains
{
    public const DOMAINS = [
        'super_admin' => 'Superadmin.com',
        'admin' => 'Administrator.com',
        'accounting_clerk' => 'Clerk.com',
        'accounting_officer' => 'Officer.com',
        'supervisor_manager' => 'Supervisor.com',
    ];

    /** Allowed characters in the name part: letters, numbers, dot, dash, underscore. */
    public const USERNAME_PATTERN = '/^[a-z0-9]+([._-][a-z0-9]+)*$/i';

    public static function domainFor(string $role): ?string
    {
        return self::DOMAINS[$role] ?? null;
    }

    /** "Maria.Santos" + accounting_clerk -> "maria.santos@Clerk.com" */
    public static function emailFor(string $username, string $role): ?string
    {
        $domain = self::domainFor($role);

        return $domain ? strtolower(trim($username)).'@'.$domain : null;
    }
}
