<?php

namespace App\Mail;

use App\Models\Company;
use App\Models\User;
use App\Models\Voucher;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * "Your voucher was sent back / rejected" (Accounting review, Framer XT9f8T3lY / sozCOjfDk, 2026-11-26),
 * to the clerk who made it, together with the bell notice. Approvals only get the bell notice.
 */
class VoucherDecisionMail extends Mailable
{
    use Queueable, SerializesModels;

    /** @param  list<string>  $needsChanges  labels, e.g. ["Line items", "Amount"] */
    public function __construct(
        public User $clerk,
        public User $reviewer,
        public Company $company,
        public Voucher $voucher,
        public string $decision, // 'returned' | 'rejected'
        public string $remarks,
        public array $needsChanges = [],
        public ?string $reason = null,
        public ?string $link = null,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: $this->decision === 'returned'
            ? "{$this->voucher->voucher_number} was sent back to you"
            : "{$this->voucher->voucher_number} was rejected");
    }

    public function content(): Content
    {
        return new Content(view: 'emails.voucher-decision');
    }
}
