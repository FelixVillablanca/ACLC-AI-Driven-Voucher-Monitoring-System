<?php

namespace App\Domain\Tenancy\Actions;

use App\Domain\Identity\Support\AccountStanding;
use App\Domain\Security\Support\OwnerActivity;
use App\Domain\Tenancy\Queries\CompanyDirectory;
use App\Exceptions\ApiException;
use App\Models\Company;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * "Suspend company" (Framer C6 eGUijf8Wd). Nobody in the company can sign in until a Super Admin
 * reactivates it; nothing is deleted.
 *
 * One transaction:
 *   1. LOCK the company row (two Super Admins clicking at once: the second one gets 409)
 *   2. is_active = false + suspended_at / suspended_by / suspension_reason
 *   3. sign out, right now, everyone the suspension blocks. AccountStanding is the one rule that
 *      decides it: someone who also works in another, active company keeps working there.
 *   4. an audit row + a bell notice for the other Super Admins
 * The email to the Admin in charge goes out AFTER the transaction (NotifyCompanyAdmins).
 */
class SuspendCompany
{
    public function __construct(private NotifyCompanyAdmins $notify) {}

    /** @return array{company: Company, signed_out: int, admins_notified: ?bool} */
    public function handle(Company $company, User $by, string $reason, bool $notifyAdmin, ?string $ip): array
    {
        [$company, $signedOut] = DB::transaction(function () use ($company, $by, $reason, $ip) {
            /** @var Company $company */
            $company = Company::whereKey($company->id)->lockForUpdate()->firstOrFail();

            if ($company->isSuspended()) {
                throw new ApiException("{$company->name} is already suspended.", 'COMPANY_ALREADY_SUSPENDED', 409);
            }
            if (! $company->is_active) {
                throw new ApiException("{$company->name} is already inactive.", 'COMPANY_INACTIVE', 409);
            }

            $company->forceFill([
                'is_active' => false,
                'suspended_at' => now(),
                'suspended_by' => $by->id,
                'suspension_reason' => $reason,
            ])->save();

            $signedOut = 0;
            foreach (CompanyDirectory::usersOf($company->id)->get() as $user) {
                if (AccountStanding::problem($user) !== null) {
                    OwnerActivity::signOutEverywhere($user);
                    $signedOut++;
                }
            }

            OwnerActivity::audit($by, 'company_suspended', 'companies', $company->id,
                ['is_active' => true],
                ['is_active' => false, 'reason' => $reason, 'users_signed_out' => $signedOut],
                $ip, $company->id);

            OwnerActivity::tellOtherOwners($by, 'company_changed', 'Company suspended',
                "{$by->full_name} suspended {$company->name}: \"{$reason}\".");

            return [$company, $signedOut];
        });

        return [
            'company' => $company,
            'signed_out' => $signedOut,
            'admins_notified' => $notifyAdmin ? $this->notify->handle($company, 'suspended', $reason) : null,
        ];
    }
}
