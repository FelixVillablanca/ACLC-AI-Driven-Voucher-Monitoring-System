<?php

namespace App\Domain\Vouchers\Support;

use App\Models\Voucher;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * The printable voucher (user decision 2026-11-26), for the clerk (their own) and the Accounting Officer.
 * Company, number, status, payee, payment, purpose, lines, total in figures and in words, and the
 * signature blocks filled from the real history: Prepared by (clerk) · Reviewed by (step 1) ·
 * Approved by (step 2, or step 1 when Accounting's approval was final). Drafts carry a "DRAFT" mark.
 */
final class VoucherPdf
{
    public static function render(Voucher $voucher): string
    {
        $company = DB::table('companies')->where('id', $voucher->company_id)->first(['name', 'address']);
        $clerk = DB::table('users')->where('id', $voucher->created_by)->first(['first_name', 'last_name']);
        $lines = DB::table('voucher_line_items')->where('voucher_id', $voucher->id)->orderBy('sort_order')->orderBy('id')
            ->get(['description', 'quantity', 'unit', 'unit_price', 'total_price']);
        $approvals = DB::table('voucher_approvals as a')->leftJoin('users as u', 'u.id', '=', 'a.approver_id')
            ->where('a.voucher_id', $voucher->id)->where('a.action', 'approved')->orderBy('a.id')
            ->get(['a.step', 'a.created_at', 'u.first_name', 'u.last_name']);

        $sign = fn ($row) => $row ? ['name' => trim("{$row->first_name} {$row->last_name}"), 'at' => Carbon::parse($row->created_at)->format('M j, Y')] : null;
        $step1 = $approvals->firstWhere('step', 1);
        $step2 = $approvals->firstWhere('step', 2);
        $finalAtStep1 = $voucher->status === 'approved' && ! $step2;

        $name = fn (string $table, ?int $id) => $id ? DB::table($table)->where('id', $id)->value('name') : null;

        return Pdf::loadView('pdf.voucher', [
            'v' => $voucher,
            'number' => VoucherNumber::isDraft($voucher->voucher_number) ? 'Draft (no number yet)' : $voucher->voucher_number,
            'company' => $company,
            'category' => $name('voucher_categories', $voucher->category_id),
            'department' => $name('departments', $voucher->department_id),
            'payeeType' => $name('payee_types', $voucher->payee_type_id),
            'voucherType' => $name('voucher_types', $voucher->voucher_type_id),
            'lines' => $lines,
            'words' => AmountInWords::pesos((string) $voucher->amount),
            'prepared' => $clerk ? ['name' => trim("{$clerk->first_name} {$clerk->last_name}"), 'at' => ($voucher->submitted_at ?? $voucher->created_at)?->format('M j, Y')] : null,
            'reviewed' => $sign($step1),
            'approved' => $finalAtStep1 ? $sign($step1) : $sign($step2),
            'printedAt' => now()->format('M j, Y g:i A'),
        ])->setPaper('a4')->output();
    }

    public static function fileName(Voucher $voucher): string
    {
        return (VoucherNumber::isDraft($voucher->voucher_number) ? 'draft-voucher-'.$voucher->id : $voucher->voucher_number).'.pdf';
    }
}
