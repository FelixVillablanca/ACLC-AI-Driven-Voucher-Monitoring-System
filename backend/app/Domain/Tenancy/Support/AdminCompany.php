<?php

namespace App\Domain\Tenancy\Support;

use App\Exceptions\ApiException;
use App\Models\Company;
use App\Models\User;

/**
 * The ONE company an Admin runs (users.company_id, chosen by the Super Admin, since 2026-11-20).
 * Every Admin action that adds something (users, departments, access) goes through here, so they
 * all refuse the same way when the Admin has no company or it isn't active.
 */
class AdminCompany
{
    /** @throws ApiException 403 NO_ACTIVE_COMPANY */
    public static function activeFor(User $admin, string $what = 'anything'): Company
    {
        $company = $admin->company_id ? Company::find($admin->company_id) : null;

        if (! $company) {
            throw new ApiException("Your account isn't linked to a company yet, so you can't add {$what}. Ask a Super Admin to assign one.", 'NO_ACTIVE_COMPANY', 403);
        }
        if (! $company->is_active || $company->isSuspended()) {
            throw new ApiException("{$company->name} isn't active, so you can't add {$what}.", 'NO_ACTIVE_COMPANY', 403);
        }

        return $company;
    }
}
