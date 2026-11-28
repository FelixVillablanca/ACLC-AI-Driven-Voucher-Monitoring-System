<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * "Your Admin account was removed" (user decision 2026-11-28): an Admin created with "No company yet" who wasn't
 * given a company within 24 hours. Sent to their personal email by ExpireUnassignedAdmins after the removal.
 * Plain values only (the account may be deleted by then).
 */
class UnassignedAdminRemovedMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public string $firstName,
        public string $workEmail,
        public bool $deleted, // true = deleted, false = deactivated
        public int $graceHours,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: 'Your Admin account was removed');
    }

    public function content(): Content
    {
        return new Content(view: 'emails.unassigned-admin-removed');
    }
}
