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
 * Names are unique (index companies_name_unique): if two saves race, the second gets the same 422
 * as the form check ("A company with this name already exists.") instead of a server error.
 */
class CreateCompany
{
    /** @param array{name: string, type: string, address?: ?string, contact_email?: ?string, contact_phone?: ?string, tin_number?: ?string, fiscal_year_start?: ?string} $data */
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
            $company = Company::create([...$data, 'is_active' => true]);

            OwnerActivity::audit($by, 'company_created', 'companies', $company->id, null, [
                'name' => $company->name,
                'type' => $company->type,
                'address' => $company->address,
                'contact_email' => $company->contact_email,
            ], $ip, $company->id);

            OwnerActivity::tellOtherOwners($by, 'company_changed', 'Company added',
                "{$by->full_name} added {$company->name}. It has no Admin yet.");

            return $company;
        });
    }
}
