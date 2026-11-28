<?php

namespace App\Mail;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * "Your account is ready: set your password" (decided 2026-11-20).
 * Sent to the person's PERSONAL email. It contains their work sign-in email and a one-time
 * link (72 h) to choose a password. It never contains a password.
 */
class AccountInvitationMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public User $user,
        public string $link,
        public ?string $companyName, // null = an Admin with no company yet
        public int $expiresInHours,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: 'Your Admin account is ready: set your password');
    }

    public function content(): Content
    {
        return new Content(view: 'emails.account-invitation');
    }
}
