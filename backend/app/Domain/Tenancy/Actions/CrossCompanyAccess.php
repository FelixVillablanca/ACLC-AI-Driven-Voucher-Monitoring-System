<?php

namespace App\Domain\Tenancy\Actions;

use App\Domain\Audit\AuditTrail;
use App\Domain\Tenancy\Queries\AccessCandidates;
use App\Domain\Tenancy\Support\AdminCompany;
use App\Exceptions\ApiException;
use App\Models\Company;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Working in more than one company (user decisions 2026-11-22). Two ways in, one row per person + company:
 *
 *   INVITE   an Admin invites a clerk / officer / supervisor of ANOTHER company   → that person accepts / declines
 *   REQUEST  a clerk / officer / supervisor asks to join a company                  → that company's Admin approves / declines
 *
 * The row (user_company_access) is `pending` while waiting, then `accepted` or `denied`. Cancelling a
 * pending invite / request deletes the row (it never gave access; the audit log keeps the story).
 * Every step: one transaction, the row locked, one audit row, a bell notice to the other side.
 * Admins are never invited or asked about: an Admin runs exactly one company.
 */
class CrossCompanyAccess
{
    // ---------- Admin side ----------

    public function invite(User $admin, int $userId, ?string $message, ?string $ip = null): User
    {
        $company = AdminCompany::activeFor($admin, 'invitations');

        return DB::transaction(function () use ($admin, $userId, $message, $ip, $company) {
            $person = $this->operationalUser($userId);
            if ((int) $person->company_id === $company->id) {
                throw new ApiException("{$person->full_name} already belongs to {$company->name}. Use Grant access instead.", 'SAME_COMPANY', 409);
            }

            $row = $this->row($person->id, $company->id);
            if ($row && in_array($row->granted_status, ['accepted', 'pending'], true)) {
                throw new ApiException(
                    $row->granted_status === 'accepted'
                        ? "{$person->full_name} already works in {$company->name}."
                        : "{$person->full_name} already has an open invitation or request for {$company->name}.",
                    'ACCESS_ALREADY_OPEN',
                    409,
                );
            }

            $id = $this->open($row, $person->id, $company->id, 'invite', $admin->id, $message);
            $this->audit($admin, 'access_invited', $company->id, $id, $person, ['message' => $message], $ip);
            $this->tell([$person->id], 'Invitation to join '.$company->name,
                "{$admin->full_name} invited you to work in {$company->name}. Open the company switcher to answer.".($message ? " “{$message}”" : ''));

            return $person;
        });
    }

    public function cancelInvite(User $admin, int $userId, ?string $ip = null): void
    {
        $company = AdminCompany::activeFor($admin, 'invitations');

        DB::transaction(function () use ($admin, $userId, $ip, $company) {
            $row = $this->pendingRow($userId, $company->id, 'invite', 'invitation');
            $person = User::findOrFail($userId);
            DB::table('user_company_access')->where('id', $row->id)->delete();
            $this->audit($admin, 'access_invite_cancelled', $company->id, $row->id, $person, null, $ip);
        });
    }

    public function answerRequest(User $admin, int $userId, bool $approve, ?string $reason, ?string $ip = null): User
    {
        $company = AdminCompany::activeFor($admin, 'access changes');

        return DB::transaction(function () use ($admin, $userId, $approve, $reason, $ip, $company) {
            $row = $this->pendingRow($userId, $company->id, 'request', 'request');
            $person = User::findOrFail($userId);

            $this->close($row->id, $approve ? 'accepted' : 'denied', $admin->id);
            $this->audit($admin, $approve ? 'access_request_approved' : 'access_request_declined', $company->id, $row->id, $person,
                array_filter(['reason' => $reason]), $ip);
            $this->tell([$person->id],
                $approve ? "You can now work in {$company->name}" : "Your request to join {$company->name} was declined",
                $approve
                    ? "{$admin->full_name} approved your request. Pick {$company->name} in the company switcher."
                    : "{$admin->full_name} declined your request.".($reason ? " “{$reason}”" : ''));

            return $person;
        });
    }

    // ---------- Person side (clerk / officer / supervisor) ----------

    public function request(User $person, int $companyId, ?string $message, ?string $ip = null): Company
    {
        $this->assertOperational($person);

        return DB::transaction(function () use ($person, $companyId, $message, $ip) {
            $company = Company::whereKey($companyId)->where('is_active', true)->whereNull('suspended_at')->first();
            if (! $company) {
                throw new ApiException("That company isn't taking requests right now.", 'COMPANY_UNAVAILABLE', 404);
            }

            $row = $this->row($person->id, $company->id);
            if ($row && in_array($row->granted_status, ['accepted', 'pending'], true)) {
                throw new ApiException(
                    $row->granted_status === 'accepted'
                        ? "You already work in {$company->name}."
                        : "You already have an open invitation or request for {$company->name}.",
                    'ACCESS_ALREADY_OPEN',
                    409,
                );
            }

            $id = $this->open($row, $person->id, $company->id, 'request', $person->id, $message);
            $this->audit($person, 'access_requested', $company->id, $id, $person, ['message' => $message], $ip);
            $this->tell(User::where('role', 'admin')->where('company_id', $company->id)->pluck('id')->all(),
                'Request to join '.$company->name,
                "{$person->full_name} ({$this->roleLabel($person->role)}) asked to work in {$company->name}. Answer it in Company access → Requests."
                .($message ? " “{$message}”" : ''));

            return $company;
        });
    }

    public function cancelRequest(User $person, int $companyId, ?string $ip = null): void
    {
        DB::transaction(function () use ($person, $companyId, $ip) {
            $row = $this->pendingRow($person->id, $companyId, 'request', 'request');
            DB::table('user_company_access')->where('id', $row->id)->delete();
            $this->audit($person, 'access_request_cancelled', $companyId, $row->id, $person, null, $ip);
        });
    }

    public function answerInvite(User $person, int $companyId, bool $accept, ?string $ip = null): Company
    {
        return DB::transaction(function () use ($person, $companyId, $accept, $ip) {
            $row = $this->pendingRow($person->id, $companyId, 'invite', 'invitation');
            $company = Company::findOrFail($companyId);
            if ($accept && (! $company->is_active || $company->isSuspended())) {
                throw new ApiException("{$company->name} is suspended right now, so you can't join it.", 'COMPANY_SUSPENDED', 409);
            }

            $this->close($row->id, $accept ? 'accepted' : 'denied', $person->id);
            $this->audit($person, $accept ? 'access_invite_accepted' : 'access_invite_declined', $company->id, $row->id, $person, null, $ip);
            $this->tell(User::where('role', 'admin')->where('company_id', $company->id)->pluck('id')->all(),
                $accept ? "{$person->full_name} joined {$company->name}" : "{$person->full_name} declined your invitation",
                $accept
                    ? "{$person->full_name} accepted the invitation and can now work in {$company->name}."
                    : "{$person->full_name} won't join {$company->name} for now.");

            return $company;
        });
    }

    // ---------- shared ----------

    private function operationalUser(int $id): User
    {
        $user = User::whereKey($id)->whereIn('role', AccessCandidates::OPERATIONAL_ROLES)->where('is_active', true)->lockForUpdate()->first();
        if (! $user) {
            throw new ApiException('We could not find what you are looking for.', 'NOT_FOUND', 404);
        }

        return $user;
    }

    private function assertOperational(User $user): void
    {
        if (! in_array($user->role, AccessCandidates::OPERATIONAL_ROLES, true)) {
            throw new ApiException('Only clerks, officers and supervisors can work in more than one company.', 'ROLE_NOT_ALLOWED', 403);
        }
    }

    private function row(int $userId, int $companyId): ?object
    {
        return DB::table('user_company_access')->where('user_id', $userId)->where('company_id', $companyId)->lockForUpdate()->first();
    }

    /** The pending invite / request, or 404 (nothing to answer: maybe already answered or cancelled). */
    private function pendingRow(int $userId, int $companyId, string $kind, string $noun): object
    {
        $row = $this->row($userId, $companyId);
        if (! $row || $row->kind !== $kind || $row->granted_status !== 'pending') {
            throw new ApiException("There's no open {$noun} to answer. It may have been answered or cancelled already.", 'NOTHING_PENDING', 404);
        }

        return $row;
    }

    /** A new pending row, or the old denied one re-opened (one row per person + company). */
    private function open(?object $row, int $userId, int $companyId, string $kind, int $by, ?string $message): int
    {
        $values = [
            'granted_status' => 'pending', 'kind' => $kind, 'requested_by' => $by, 'message' => $message,
            'responded_at' => null, 'responded_by' => null, 'granted_by' => null, 'granted_at' => now(), 'updated_at' => now(),
        ];
        if ($row) {
            DB::table('user_company_access')->where('id', $row->id)->update($values);

            return $row->id;
        }

        return DB::table('user_company_access')->insertGetId([...$values, 'user_id' => $userId, 'company_id' => $companyId, 'created_at' => now()]);
    }

    private function close(int $rowId, string $status, int $by): void
    {
        DB::table('user_company_access')->where('id', $rowId)->update([
            'granted_status' => $status, 'responded_at' => now(), 'responded_by' => $by,
            'granted_by' => $status === 'accepted' ? $by : null, 'granted_at' => now(), 'updated_at' => now(),
        ]);
    }

    private function audit(User $by, string $action, int $companyId, int $rowId, User $person, ?array $extra, ?string $ip): void
    {
        AuditTrail::record([
            'user_id' => $by->id,
            'company_id' => $companyId,
            'action' => $action,
            'table_name' => 'user_company_access',
            'record_id' => $rowId,
            'new_values' => array_filter([
                'user_id' => $person->id, 'first_name' => $person->first_name, 'last_name' => $person->last_name, ...($extra ?? []),
            ], fn ($v) => $v !== null),
            'ip_address' => $ip,
        ]);
    }

    /** @param list<int> $recipients */
    private function tell(array $recipients, string $title, string $message): void
    {
        foreach (array_unique($recipients) as $id) {
            Notification::create(['recipient_id' => $id, 'type' => 'access_changed', 'title' => $title, 'message' => $message]);
        }
    }

    private function roleLabel(string $role): string
    {
        return ['accounting_clerk' => 'Accounting Clerk', 'accounting_officer' => 'Accounting Officer', 'supervisor_manager' => 'Supervisor'][$role] ?? $role;
    }
}
