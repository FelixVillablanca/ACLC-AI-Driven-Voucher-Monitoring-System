<?php

namespace App\Mail;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * "Two-step sign-in is now required: here's how to set it up" (A11 "Email them the setup steps now").
 * Sent to the PERSONAL email. Contains no codes or keys: the QR code is only shown after they sign in.
 */
class TwoFactorSetupMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public User $user, public int $setupDays) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: 'Two-step sign-in is now required for your account');
    }

    public function content(): Content
    {
        return new Content(view: 'emails.two-factor-setup', with: ['signInUrl' => config('app.frontend_url').'/login']);
    }
}
