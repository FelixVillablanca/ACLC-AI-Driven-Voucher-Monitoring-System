<?php

namespace App\Domain\Tenancy\Actions;

use App\Mail\CompanyStatusMail;
use App\Models\Company;
use App\Models\Notification;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Throwable;

/**
 * Tells the company's Admin(s) in charge that their company was suspended or reactivated.
 *
 * By EMAIL, because a suspended Admin can't sign in to see the bell. It goes to their personal
 * email (where their invitation went), or to their sign-in email if they have none.
 * A bell notice is added too, so it's in their list once they're back in.
 *
 * Runs AFTER the change is saved: a mail server problem must never undo a suspension.
 * Returns true (sent to everyone), false (at least one email failed), or null (no Admin to tell).
 */
class NotifyCompanyAdmins
{
    public function handle(Company $company, string $what, ?string $reason): ?bool
    {
        $admins = $company->admins()->where('is_active', true)->get();
        if ($admins->isEmpty()) {
            return null;
        }

        $allSent = true;
        foreach ($admins as $admin) {
            Notification::create([
                'recipient_id' => $admin->id,
                'type' => 'company_changed',
                'title' => $what === 'suspended' ? 'Your company was suspended' : 'Your company is active again',
                'message' => $what === 'suspended'
                    ? "{$company->name} was suspended by the platform owner".($reason ? ": \"{$reason}\"" : '.')
                    : "{$company->name} was reactivated. Everyone can sign in again.",
            ]);

            try {
                Mail::to($admin->personal_email ?: $admin->email)->send(new CompanyStatusMail($admin, $company, $what, $reason));
            } catch (Throwable $e) {
                Log::warning('Company status email failed', [
                    'company_id' => $company->id, 'user_id' => $admin->id, 'error' => $e->getMessage(),
                ]);
                $allSent = false;
            }
        }

        return $allSent;
    }
}
