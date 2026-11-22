<?php

namespace App\Mail;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * "Someone tried to sign in to your account" (Audit logs AL8, "Email … that someone tried their
 * accounts"), sent to the person's personal email after a Super Admin blocks the address.
 */
class SignInAttemptsMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public User $user, public string $ip) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: 'Someone tried to sign in to your account');
    }

    public function content(): Content
    {
        return new Content(view: 'emails.sign-in-attempts');
    }
}
