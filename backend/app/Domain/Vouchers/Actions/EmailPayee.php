<?php

namespace App\Domain\Vouchers\Actions;

use App\Domain\Audit\AuditTrail;
use App\Domain\Vouchers\Support\PaymentSlipPdf;
use App\Exceptions\ApiException;
use App\Mail\PaymentApprovedMail;
use App\Models\User;
use App\Models\Voucher;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Throwable;

/**
 * "Email the payee" (user decisions 2026-11-28): after the Supervisor's final approval, the clerk who made the voucher
 * sends the payee "your payment was approved" with the payment PDF attached (the payee copy: account number masked).
 * Optional short note from the clerk. 409 VOUCHER_NOT_APPROVED / NO_PAYEE_EMAIL; 503 EMAIL_FAILED when sending fails
 * (nothing is recorded then). Audited as payee_emailed (who, to whom; never the attachment).
 */
class EmailPayee
{
    /** @return array{sent_to: string, sent_at: string} */
    public function handle(Voucher $voucher, User $clerk, ?string $note, ?string $ip): array
    {
        PaymentSlipPdf::ensureApproved($voucher);
        if (! $voucher->payee_email) {
            throw new ApiException(
                'This voucher has no payee email, so there’s nobody to send it to. Download the payment PDF and send it yourself.',
                'NO_PAYEE_EMAIL',
                409,
            );
        }

        $company = DB::table('companies')->where('id', $voucher->company_id)->value('name');

        try {
            Mail::to($voucher->payee_email)->send(new PaymentApprovedMail(
                $voucher, (string) $company, $clerk, $note, PaymentSlipPdf::render($voucher, forPayee: true), PaymentSlipPdf::fileName($voucher),
            ));
        } catch (Throwable $e) {
            Log::warning('Payee email failed', ['voucher' => $voucher->id, 'error' => $e->getMessage()]);
            throw new ApiException('The email couldn’t be sent right now. Try again in a moment, or download the PDF and send it yourself.', 'EMAIL_FAILED', 503);
        }

        AuditTrail::record([
            'user_id' => $clerk->id,
            'company_id' => $voucher->company_id,
            'action' => 'payee_emailed',
            'table_name' => 'vouchers',
            'record_id' => $voucher->id,
            'old_values' => null,
            'new_values' => array_filter([
                'voucher_number' => $voucher->voucher_number,
                'sent_to' => $voucher->payee_email,
                'note' => $note,
            ], fn ($v) => $v !== null),
            'ip_address' => $ip,
        ]);

        return ['sent_to' => $voucher->payee_email, 'sent_at' => now()->toIso8601String()];
    }
}
