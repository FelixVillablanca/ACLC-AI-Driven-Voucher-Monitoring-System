<?php

namespace Database\Seeders;

use App\Models\Company;
use App\Models\Department;
use App\Models\PayeeType;
use App\Models\VoucherCategory;
use App\Models\VoucherType;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * SAMPLE SETUP LISTS: departments, voucher categories, voucher types and payee types for each demo
 * company (asked for by the user 2026-11-25). In the real app an Admin adds these on Organization → Departments
 * and Configuration → Categories; this just saves typing them by hand while testing.
 *
 *   php artisan db:seed --class=SampleCatalogSeeder --env=testing
 *
 * Rules:
 *   - Companies are found by NAME and must already exist (DemoDataSeeder creates both below).
 *     A company that doesn't exist is skipped with a warning.
 *   - SAFE TO RUN AGAIN: a department or category whose CODE already exists in that company, or a voucher
 *     or payee type whose NAME already exists there, is skipped (never duplicated, never overwritten).
 *   - To add your own: add a row to the lists below and run the command again.
 *   - Never runs in production.
 */
class SampleCatalogSeeder extends Seeder
{
    /** Voucher types are the same kinds of payment in both companies. */
    private const VOUCHER_TYPES = [
        'Cash Disbursement',
        'Check Disbursement',
        'Petty Cash Replenishment',
        'Reimbursement',
        'Cash Advance',
        'Liquidation',
    ];

    /** Who gets paid: the same kinds of payee in both companies. */
    private const PAYEE_TYPES = [
        'Supplier',
        'Employee',
        'Contractor',
        'Service Provider',
        'Utility Company',
        'Government Agency',
        'Individual',
    ];

    /**
     * Per company: departments [code => name] and categories [code => [name, description]].
     *
     * @var array<string, array{departments: array<string, string>, categories: array<string, array{0: string, 1: string}>}>
     */
    private array $companies = [
        'Apex Holdings Inc.' => [
            'departments' => [
                'FIN' => 'Finance',
                'HR' => 'Human Resources',
                'OPS' => 'Operations',
                'IT' => 'Information Technology',
                'MKT' => 'Marketing',
                'ADM' => 'Administration',
            ],
            'categories' => [
                'OFS' => ['Office Supplies', 'Paper, ink, pens and other day-to-day office items.'],
                'UTL' => ['Utilities', 'Electricity, water, internet and phone bills.'],
                'TRV' => ['Travel & Transportation', 'Fares, fuel, tolls, parking and accommodation for work trips.'],
                'RPM' => ['Repairs & Maintenance', 'Fixing and servicing the office, vehicles and equipment.'],
                'PRF' => ['Professional Fees', 'Lawyers, auditors, consultants and other outside professionals.'],
                'TRN' => ['Training & Seminars', 'Courses, seminars and training materials for staff.'],
                'RNT' => ['Rent', 'Office, warehouse and equipment rental.'],
                'MLR' => ['Meals & Representation', 'Client meals and business representation.'],
                'EQP' => ['Equipment & IT', 'Computers, devices, software and furniture.'],
            ],
        ],
        'Northfield Academy' => [
            'departments' => [
                'ACC' => 'Accounting',
                'REG' => 'Registrar',
                'ACD' => 'Academics',
                'FAC' => 'Facilities',
                'SAO' => 'Student Affairs',
                'LIB' => 'Library',
                'IT' => 'Information Technology',
            ],
            'categories' => [
                'INS' => ['Instructional Materials', 'Books, modules and teaching aids for classes.'],
                'LAB' => ['Laboratory Supplies', 'Chemicals, specimens and lab equipment.'],
                'UTL' => ['Utilities', 'Electricity, water, internet and phone bills.'],
                'RPM' => ['Repairs & Maintenance', 'Classroom, building and equipment repairs.'],
                'EVT' => ['Events & Activities', 'School events, sports fests and student activities.'],
                'LBR' => ['Library Resources', 'Books, journals and online subscriptions for the library.'],
                'OFS' => ['Office Supplies', 'Paper, ink, pens and other day-to-day office items.'],
                'PRF' => ['Professional Fees', 'Guest speakers, consultants and other outside professionals.'],
                'TRV' => ['Travel & Transportation', 'Fares, fuel and accommodation for school trips and seminars.'],
            ],
        ],
    ];

    public function run(): void
    {
        if (app()->environment('production')) {
            $this->command?->warn('SampleCatalogSeeder skipped: it never runs in production.');

            return;
        }

        foreach ($this->companies as $companyName => $lists) {
            $company = Company::query()->where('name', $companyName)->first();
            if (! $company) {
                $this->command?->warn("  {$companyName}: company not found, skipped (run DemoDataSeeder first).");

                continue;
            }

            $added = DB::transaction(fn () => [
                'departments' => $this->departments($company, $lists['departments']),
                'categories' => $this->categories($company, $lists['categories']),
                'voucher types' => $this->named(VoucherType::class, $company, self::VOUCHER_TYPES),
                'payee types' => $this->named(PayeeType::class, $company, self::PAYEE_TYPES),
            ]);

            $this->command?->info(sprintf('  %s: added %d departments, %d categories, %d voucher types, %d payee types',
                $companyName, $added['departments'], $added['categories'], $added['voucher types'], $added['payee types']));
        }
    }

    private function departments(Company $company, array $departments): int
    {
        $added = 0;
        foreach ($departments as $code => $name) {
            $department = Department::query()->firstOrCreate(
                ['company_id' => $company->id, 'code' => $code],
                ['name' => $name, 'is_active' => true],
            );
            $added += (int) $department->wasRecentlyCreated;
        }

        return $added;
    }

    private function categories(Company $company, array $categories): int
    {
        $added = 0;
        foreach ($categories as $code => [$name, $description]) {
            $category = VoucherCategory::query()->firstOrCreate(
                ['company_id' => $company->id, 'code' => $code],
                ['name' => $name, 'description' => $description, 'is_active' => true],
            );
            $added += (int) $category->wasRecentlyCreated;
        }

        return $added;
    }

    /**
     * Voucher types / payee types: lists of plain names, matched by name in the company.
     *
     * @param  class-string<VoucherType|PayeeType>  $model
     * @param  list<string>  $names
     */
    private function named(string $model, Company $company, array $names): int
    {
        $added = 0;
        foreach ($names as $name) {
            $row = $model::query()->firstOrCreate(['company_id' => $company->id, 'name' => $name]);
            $added += (int) $row->wasRecentlyCreated;
        }

        return $added;
    }
}
