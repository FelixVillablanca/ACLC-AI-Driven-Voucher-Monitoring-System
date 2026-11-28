<?php

namespace App\Domain\Identity\Queries;

use App\Models\Company;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;

/**
 * The OTHER companies a clerk / officer / supervisor works in (accepted access, not their home company), 2026-11-28.
 * Deactivate switches off the whole account, so the home company's Admin is shown these before confirming,
 * and these companies' Admins are told when it happens (SetCompanyUserStatus).
 */
class OtherCompanies
{
    /** Active, not suspended, A–Z: the companies the person would actually lose. */
    public static function of(User $user): Collection
    {
        return Company::query()
            ->whereIn('id', DB::table('user_company_access')->where('user_id', $user->id)->where('granted_status', 'accepted')->select('company_id'))
            ->when($user->company_id, fn ($q) => $q->whereKeyNot($user->company_id))
            ->where('is_active', true)->whereNull('suspended_at')
            ->orderBy('name')
            ->get(['id', 'name']);
    }

    /** Can the home company's Admin "only remove them from your company"? (they need accepted access to it) */
    public static function hasHomeAccess(User $user): bool
    {
        return $user->company_id !== null && DB::table('user_company_access')
            ->where('user_id', $user->id)->where('company_id', $user->company_id)->where('granted_status', 'accepted')->exists();
    }
}
