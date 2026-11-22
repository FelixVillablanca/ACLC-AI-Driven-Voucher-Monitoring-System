<?php

namespace App\Domain\Tenancy\Support;

use App\Models\Company;
use App\Models\User;
use App\Support\Exports\TabularExport;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * "Export companies" (Framer C1 UpMMFLXSI): the company list as Excel, CSV or PDF.
 * Counts and dates only, never money: the Super Admin has no access to vouchers or budgets.
 * Load the companies through CompanyDirectory::withCardData() (it adds the counts and the Admin).
 */
class CompanyExport
{
    /** What can be included (the C1 checkboxes). */
    public const COLUMNS = [
        'details' => 'Name, type, address and status',
        'counts' => 'Department and user counts',
        'suspension' => 'Suspension history',
    ];

    public const FORMATS = ['xlsx', 'csv', 'pdf'];

    /** companies.type → the word people read (same words as the cards). */
    public const TYPE_LABELS = [
        'school' => 'School', 'corporate' => 'Corporation', 'government' => 'Government', 'ngo' => 'NGO', 'other' => 'Organisation',
    ];

    public function __construct(private TabularExport $files) {}

    /**
     * @param  Collection<int, Company>  $companies
     * @param  array<int, string>  $columns
     * @return array{0: array<int, string>, 1: array<int, array<int, mixed>>} [headers, rows]
     */
    public function table(Collection $companies, array $columns): array
    {
        // "Suspension history" = how many times each company was ever suspended (from the audit log)
        $timesSuspended = in_array('suspension', $columns, true)
            ? DB::table('audit_logs')
                ->where('table_name', 'companies')->where('action', 'company_suspended')
                ->whereIn('record_id', $companies->pluck('id'))
                ->groupBy('record_id')->pluck(DB::raw('COUNT(*)'), 'record_id')
            : collect();

        $headers = [];
        foreach ($columns as $column) {
            $headers = [...$headers, ...match ($column) {
                'details' => ['Company', 'Type', 'Address', 'Status', 'Admin in charge', 'On the platform since'],
                'counts' => ['Departments', 'Users'],
                'suspension' => ['Times suspended', 'Suspended on', 'Suspended by', 'Reason'],
            }];
        }

        $rows = $companies->map(function (Company $c) use ($columns, $timesSuspended) {
            $row = [];
            foreach ($columns as $column) {
                $row = [...$row, ...match ($column) {
                    'details' => [
                        $c->name,
                        self::TYPE_LABELS[$c->type] ?? (string) $c->type,
                        (string) $c->address,
                        $c->isSuspended() ? 'Suspended' : ($c->is_active ? 'Active' : 'Inactive'),
                        $c->relationLoaded('admins') ? ($c->admins->first()?->full_name ?? 'No Admin yet') : '',
                        $c->created_at?->format('Y-m-d') ?? '',
                    ],
                    'counts' => [(int) $c->departments_count, (int) $c->users_count],
                    'suspension' => [
                        (int) ($timesSuspended[$c->id] ?? 0),
                        $c->suspended_at?->format('Y-m-d H:i') ?? '',
                        $c->isSuspended() ? ($c->suspendedBy?->full_name ?? 'A Super Admin') : '',
                        (string) $c->suspension_reason,
                    ],
                }];
            }

            return $row;
        })->all();

        return [$headers, $rows];
    }

    /** The file body for the chosen format. */
    public function file(string $format, array $headers, array $rows, User $by): string
    {
        return match ($format) {
            'csv' => $this->files->csv($headers, $rows),
            'xlsx' => $this->files->xlsx('Companies', $headers, $rows),
            'pdf' => Pdf::loadView('exports.companies', [
                'headers' => $headers,
                'rows' => $rows,
                'by' => $by->full_name,
                'at' => now()->format('M j, Y H:i'),
            ])->setPaper('a4', count($headers) > 6 ? 'landscape' : 'portrait')->output(),
        };
    }

    public static function contentType(string $format): string
    {
        return match ($format) {
            'csv' => 'text/csv; charset=UTF-8',
            'xlsx' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'pdf' => 'application/pdf',
        };
    }
}
