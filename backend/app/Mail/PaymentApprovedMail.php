<?php

namespace App\Mail;

use App\Domain\Vouchers\Support\PaymentSlipPdf;
use App\Models\User;
use App\Models\Voucher;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Attachment;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

/**
 * "Your payment from Apex Holdings was approved" (user decision 2026-11-28), sent to the payee by "Email the payee",
 * with the payee copy of the payment PDF attached. Contains: company, voucher number, amount, method, the clerk's note.
 */
class PaymentApprovedMail extends Mailable
{
    use Queueable;

    public function __construct(
        public Voucher $voucher,
        public string $companyName,
        public User $clerk,
        public ?string $note,
        public string $pdf,
        public string $pdfName,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: "Your payment from {$this->companyName} was approved ({$this->voucher->voucher_number})");
    }

    public function content(): Content
    {
        return new Content(view: 'emails.payment-approved', with: [
            'method' => PaymentSlipPdf::TITLES[$this->voucher->payment_method] ?? 'Payment',
        ]);
    }

    /** @return list<Attachment> */
    public function attachments(): array
    {
        return [Attachment::fromData(fn () => $this->pdf, $this->pdfName)->withMime('application/pdf')];
    }
}
