<?php

namespace App\Domain\Tenancy\Actions;

use App\Domain\Security\Support\OwnerActivity;
use App\Models\Company;
use App\Models\User;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * "Add company" (Super Admin only, since 2026-11-20 Admins can't create companies).
 * One transaction: the company row + an audit row + a bell notice to the other Super Admins.
 * The new company is active right away, so it shows up in the Add admin "Company" select at once.
 * Optional admin_id (2026-11-28): an Admin with "No company yet" becomes its Admin in the same transaction (their
 * row locked; if someone gave them a company a moment ago: 409 ADMIN_ALREADY_ASSIGNED and nothing is saved), with
 * an audit row and a bell notice to that Admin.
 * Names are unique (index companies_name_unique): if two saves race, the second gets the same 422
 * as the form check ("A company with this name already exists.") instead of a server error.
 */
class CreateCompany
{
    public function __construct(private readonly AssignCompanyAdmin $assignAdmin) {}

    /** @param array{name: string, type: string, address?: ?string, latitude?: ?string, longitude?: ?string, place_id?: ?string, contact_email?: ?string, contact_phone?: ?string, tin_number?: ?string, fiscal_year_start?: ?string, admin_id?: ?int} $data */
    public function handle(array $data, User $by, ?string $ip): Company
    {
        try {
            return $this->create($data, $by, $ip);
        } catch (UniqueConstraintViolationException) {
            throw ValidationException::withMessages(['name' => 'A company with this name already exists.']);
        }
    }

    private function create(array $data, User $by, ?string $ip): Company
    {
        return DB::transaction(function () use ($data, $by, $ip) {
            $adminId = $data['admin_id'] ?? null;
            unset($data['admin_id']);

            $company = Company::create([...$data, 'is_active' => true]);

            OwnerActivity::audit($by, 'company_created', 'companies', $company->id, null, [
                'name' => $company->name,
                'type' => $company->type,
                'address' => $company->address,
                'location' => $company->latitude !== null ? "{$company->latitude}, {$company->longitude}" : null,
                'contact_email' => $company->contact_email,
            ], $ip, $company->id);

            $admin = $adminId ? $this->assignAdmin->assign((int) $adminId, $company, $by, $ip) : null;

            OwnerActivity::tellOtherOwners($by, 'company_changed', 'Company added', $admin
                ? "{$by->full_name} added {$company->name} and made {$admin->full_name} its Admin."
                : "{$by->full_name} added {$company->name}. It has no Admin yet.");

            return $company;
        });
    }
}
