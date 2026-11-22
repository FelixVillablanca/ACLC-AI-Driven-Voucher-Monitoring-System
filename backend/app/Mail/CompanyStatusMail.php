<?php

namespace App\Mail;

use App\Models\Company;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * "Your company was suspended" / "Your company is active again" (Companies tab C6 / C7),
 * sent to the Admin in charge of that company.
 */
class CompanyStatusMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public User $admin,
        public Company $company,
        public string $what, // 'suspended' | 'reactivated'
        public ?string $reason = null, // the suspension reason, or the reactivation note
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: $this->what === 'suspended'
            ? "{$this->company->name} has been suspended"
            : "{$this->company->name} is active again");
    }

    public function content(): Content
    {
        return new Content(view: 'emails.company-status');
    }
}
