<?php

namespace App\Domain\Identity\Support;

use App\Models\User;
use App\Support\Exports\TabularExport;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Collection;

/**
 * "Export admin list" (A1): turns accounts into a CSV (Excel / Google Sheets) or a PDF.
 * Passwords, two-step keys and backup codes are NEVER included: they aren't even columns here.
 */
class AdminExport
{
    /** What can be included (the A1 checkboxes). */
    public const COLUMNS = [
        'name' => 'Name and email',
        'role_status' => 'Role and status',
        'two_factor' => 'Two-step sign-in',
        'dates' => 'Last sign-in and created',
        'employee_id' => 'Employee ID',
        'company' => 'Company',
    ];

    /**
     * @param  Collection<int, User>  $accounts
     * @param  array<int, string>  $columns
     * @return array{0: array<int, string>, 1: array<int, array<int, string>>} [headers, rows]
     */
    public function table(Collection $accounts, array $columns): array
    {
        $headers = [];
        foreach ($columns as $column) {
            $headers = [...$headers, ...match ($column) {
                'name' => ['Name', 'Email'],
                'role_status' => ['Role', 'Status'],
                'two_factor' => ['Two-step sign-in'],
                'dates' => ['Last sign-in', 'Created'],
                'employee_id' => ['Employee ID'],
                'company' => ['Company'],
            }];
        }

        $rows = $accounts->map(function (User $u) use ($columns) {
            $row = [];
            foreach ($columns as $column) {
                $row = [...$row, ...match ($column) {
                    'name' => [$u->full_name, $u->email],
                    'role_status' => [$u->role === 'super_admin' ? 'Super Admin' : 'Admin', ucfirst($u->accountStatus())],
                    'two_factor' => [match ($u->twoFactorStatus()) {
                        'on' => 'On', 'required' => 'Required (not set up yet)', 'not_set_up' => 'Not set up', default => 'Off',
                    }],
                    'dates' => [$u->last_login_at?->format('Y-m-d H:i') ?? 'Never', $u->created_at?->format('Y-m-d') ?? ''],
                    'employee_id' => [$u->employee_id ?? ''],
                    'company' => [$u->company?->name ?? ($u->role === 'super_admin' ? 'All (platform)' : '')],
                }];
            }

            return $row;
        })->all();

        return [$headers, $rows];
    }

    /** The shared CSV writer (TabularExport) handles the UTF-8 marker and formula-injection guard. */
    public function csv(array $headers, array $rows): string
    {
        return app(TabularExport::class)->csv($headers, $rows);
    }

    public function pdf(array $headers, array $rows, User $by): string
    {
        return Pdf::loadView('exports.admins', [
            'headers' => $headers,
            'rows' => $rows,
            'by' => $by->full_name,
            'at' => now()->format('M j, Y H:i'),
        ])->setPaper('a4', count($headers) > 6 ? 'landscape' : 'portrait')->output();
    }
}
