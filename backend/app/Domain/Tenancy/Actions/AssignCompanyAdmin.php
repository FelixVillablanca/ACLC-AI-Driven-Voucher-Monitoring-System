<?php

namespace App\Domain\Tenancy\Actions;

use App\Domain\Identity\Queries\UnassignedAdmins;
use App\Domain\Security\Support\OwnerActivity;
use App\Exceptions\ApiException;
use App\Models\Company;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Gives a company an Admin who has "No company yet" (user requests 2026-11-28). Used two ways:
 *  - "+ Add company" → assign() inside CreateCompany's transaction
 *  - the company side panel (C8 Overview, "Admin in charge") → handle(): POST /superadmin/companies/{id}/admin
 * The Admin's row is locked and checked again (409 ADMIN_ALREADY_ASSIGNED if they got a company a moment ago); then an
 * audit row (admin_assigned) and a bell notice to that Admin. This also stops their 24-hour removal countdown.
 */
class AssignCompanyAdmin
{
    /** From the side panel: one transaction, the company must be active and have no active Admin yet. */
    public function handle(Company $company, int $adminId, User $by, ?string $ip): User
    {
        return DB::transaction(function () use ($company, $adminId, $by, $ip) {
            $company = Company::whereKey($company->id)->lockForUpdate()->firstOrFail();

            if (! $company->is_active || $company->isSuspended()) {
                throw new ApiException('Reactivate this company first: an Admin of a suspended company can’t sign in.', 'COMPANY_NOT_ACTIVE', 409);
            }
            if ($current = $company->admins()->where('is_active', true)->first()) {
                throw new ApiException("{$current->full_name} already runs this company. Reload the panel to see the latest.", 'COMPANY_HAS_ADMIN', 409);
            }

            $admin = $this->assign($adminId, $company, $by, $ip);

            OwnerActivity::tellOtherOwners($by, 'company_changed', 'Admin given a company',
                "{$by->full_name} made {$admin->full_name} the Admin of {$company->name}.");

            return $admin;
        });
    }

    /** The assignment itself; call it inside a transaction. */
    public function assign(int $adminId, Company $company, User $by, ?string $ip): User
    {
        $admin = UnassignedAdmins::query()->whereKey($adminId)->lockForUpdate()->first();
        if (! $admin) {
            throw new ApiException(
                'This Admin was given a company or removed a moment ago. Pick another one.',
                'ADMIN_ALREADY_ASSIGNED',
                409,
            );
        }

        $admin->forceFill(['company_id' => $company->id])->save();

        OwnerActivity::audit($by, 'admin_assigned', 'users', $admin->id,
            ['company_id' => null], ['company_id' => $company->id, 'company' => $company->name], $ip, $company->id);

        Notification::create([
            'recipient_id' => $admin->id,
            'type' => 'company_changed',
            'title' => 'You have a company now',
            'message' => "{$by->full_name} made you the Admin of {$company->name}. Your Admin console is ready.",
        ]);

        return $admin;
    }
}
