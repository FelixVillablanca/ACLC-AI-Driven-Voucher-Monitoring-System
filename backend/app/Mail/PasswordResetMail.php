<?php

namespace App\Mail;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * "A Super Admin reset your password: choose a new one" (Security alert detail, SCoT_cu7B).
 * Sent to the PERSONAL email, with a one-time link that expires in 60 minutes. Never a password.
 */
class PasswordResetMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public User $user,
        public string $link,
        public int $expiresInMinutes,
        public bool $signedOut = true, // false = their old password still works until they use the link
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: 'Your password was reset: choose a new one');
    }

    public function content(): Content
    {
        return new Content(view: 'emails.password-reset');
    }
}
