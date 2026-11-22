<?php

namespace App\Domain\Identity\Account;

use App\Models\User;

/**
 * "Help & support" → Who can help you. Each role asks the level above it:
 *   company users (clerk / officer / supervisor) → the Admin of their company
 *   Admin                                         → the Super Admins (platform owners)
 *   Super Admin                                   → the other Super Admins
 * Only names, roles and WORK emails are shared (never personal emails).
 */
class SupportContacts
{
    /** @return array<int, array{name: string, email: string, role: string}> */
    public function for(User $user): array
    {
        $query = User::query()->where('is_active', true)->whereKeyNot($user->id)->where('access_status', 'accepted');

        $query = match ($user->role) {
            'super_admin', 'admin' => $query->where('role', 'super_admin'),
            default => $query->where('role', 'admin')->where('company_id', $user->company_id),
        };

        return $query->orderBy('first_name')->limit(5)->get(['id', 'first_name', 'last_name', 'email', 'role'])
            ->map(fn (User $u) => ['name' => $u->full_name, 'email' => $u->email, 'role' => $u->role])
            ->all();
    }
}
