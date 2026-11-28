<?php

namespace App\Domain\Vouchers\Support;

use App\Domain\Vouchers\Cheques\ChequeRules;
use App\Domain\Vouchers\VoucherStatus as S;
use App\Exceptions\ApiException;
use App\Models\Cheque;
use App\Models\Voucher;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * The PAYMENT PDF of an approved voucher (user decisions 2026-11-28), one layout per payment method:
 *   cash   → "Cash payment slip": amount, purpose, approvals and a "Received by / signature / date" block
 *   bank   → "Bank transfer advice": bank, account name and number, and blank "Transfer reference / date" lines
 *   cheque → "Cheque payment slip": blank "Cheque no. / Cheque date / Bank" lines to fill in by hand + "Received by"
 * Only after the Supervisor's final approval (409 VOUCHER_NOT_APPROVED before). `forPayee` = the copy emailed to the
 * payee: the bank account number is masked (last 4 digits only) and internal notes are left out.
 */
final class PaymentSlipPdf
{
    public const TITLES = [
        'cash' => 'Cash payment slip',
        'bank' => 'Bank transfer advice',
        'cheque' => 'Cheque payment slip',
    ];

    public static function ensureApproved(Voucher $voucher): void
    {
        if ($voucher->status !== S::Approved->value) {
            throw new ApiException(
                'The payment PDF is ready once the Supervisor / Manager gives the final approval.',
                'VOUCHER_NOT_APPROVED',
                409,
            );
        }
    }

    public static function render(Voucher $voucher, bool $forPayee = false): string
    {
        self::ensureApproved($voucher);

        $company = DB::table('companies')->where('id', $voucher->company_id)->first(['name', 'address', 'tin_number']);
        $clerk = DB::table('users')->where('id', $voucher->created_by)->first(['first_name', 'last_name']);
        $approvals = DB::table('voucher_approvals as a')->leftJoin('users as u', 'u.id', '=', 'a.approver_id')
            ->where('a.voucher_id', $voucher->id)->where('a.action', 'approved')->orderBy('a.id')
            ->get(['a.step', 'a.created_at', 'u.first_name', 'u.last_name']);
        $sign = fn ($row) => $row ? ['name' => trim("{$row->first_name} {$row->last_name}"), 'at' => Carbon::parse($row->created_at)->format('M j, Y')] : null;

        $account = (string) $voucher->bank_account_number;
        $digits = preg_replace('/\D/', '', $account);

        return Pdf::loadView('pdf.payment-slip', [
            'v' => $voucher,
            'title' => self::TITLES[$voucher->payment_method] ?? 'Payment slip',
            'method' => $voucher->payment_method,
            'company' => $company,
            'category' => $voucher->category_id ? DB::table('voucher_categories')->where('id', $voucher->category_id)->value('name') : null,
            'words' => AmountInWords::pesos((string) $voucher->amount),
            // cheque register (2026-11-29): the recorded cheque prints instead of the blank lines
            'cheque' => $voucher->payment_method === 'cheque'
                ? Cheque::query()->where('voucher_id', $voucher->id)->whereIn('status', ChequeRules::LIVE)->latest('id')->first()
                : null,
            'account' => $forPayee && strlen($digits) > 4 ? '•••• '.substr($digits, -4) : ($account ?: null),
            'prepared' => $clerk ? trim("{$clerk->first_name} {$clerk->last_name}") : null,
            'reviewed' => $sign($approvals->firstWhere('step', 1)),
            'approved' => $sign($approvals->firstWhere('step', 2)),
            'approvedAt' => $voucher->approved_at?->format('M j, Y'),
            'forPayee' => $forPayee,
            'printedAt' => now()->format('M j, Y g:i A'),
        ])->setPaper('a4')->output();
    }

    public static function fileName(Voucher $voucher): string
    {
        return "{$voucher->voucher_number}-payment.pdf";
    }
}
