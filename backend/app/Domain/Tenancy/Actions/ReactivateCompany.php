<?php

namespace App\Domain\Tenancy\Actions;

use App\Domain\Security\Support\OwnerActivity;
use App\Exceptions\ApiException;
use App\Models\Company;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * "Reactivate company" (Framer C7 B3zqVOXN4): everyone can sign in again right away.
 * (AccountStanding checks companies.is_active on every request, so nothing else needs undoing.)
 * The old reason is kept in the audit row, then cleared from the company.
 */
class ReactivateCompany
{
    public function __construct(private NotifyCompanyAdmins $notify) {}

    /** @return array{company: Company, admins_notified: ?bool} */
    public function handle(Company $company, User $by, ?string $note, bool $notifyAdmin, ?string $ip): array
    {
        $company = DB::transaction(function () use ($company, $by, $note, $ip) {
            /** @var Company $company */
            $company = Company::whereKey($company->id)->lockForUpdate()->firstOrFail();

            if (! $company->isSuspended()) {
                throw new ApiException("{$company->name} isn't suspended.", 'COMPANY_NOT_SUSPENDED', 409);
            }

            $old = [
                'is_active' => false,
                'suspended_at' => $company->suspended_at?->toIso8601String(),
                'suspended_by' => $company->suspended_by,
                'reason' => $company->suspension_reason,
            ];

            $company->forceFill([
                'is_active' => true,
                'suspended_at' => null,
                'suspended_by' => null,
                'suspension_reason' => null,
            ])->save();

            OwnerActivity::audit($by, 'company_reactivated', 'companies', $company->id,
                $old, ['is_active' => true, 'note' => $note], $ip, $company->id);

            OwnerActivity::tellOtherOwners($by, 'company_changed', 'Company reactivated',
                "{$by->full_name} reactivated {$company->name}.".($note ? " Note: \"{$note}\"" : ''));

            return $company;
        });

        return [
            'company' => $company,
            'admins_notified' => $notifyAdmin ? $this->notify->handle($company, 'reactivated', $note) : null,
        ];
    }
}
