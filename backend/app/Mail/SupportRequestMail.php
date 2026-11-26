<?php

namespace App\Mail;

use App\Models\Company;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Address;
use Illuminate\Mail\Mailables\Attachment;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

/**
 * Help & guides → Contact support (Framer mudjUlcnp, 2026-11-26): a clerk's message to their company's Admin.
 * Sent straight away (not queued): the optional screenshot is the uploaded temp file, attached here and never
 * saved on the server (user decision). Reply-To = the sender, so the Admin can answer from their mailbox.
 */
class SupportRequestMail extends Mailable
{
    use Queueable;

    public function __construct(
        public User $admin,
        public User $sender,
        public Company $company,
        public string $topic,
        public string $body,
        public ?string $voucherNumber = null,
        public ?array $screenshot = null, // ['path' => tmp path, 'name' => original name, 'mime' => …]
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: "Support request from {$this->sender->full_name}: {$this->topic}",
            replyTo: [new Address($this->sender->personal_email ?: $this->sender->email, $this->sender->full_name)],
        );
    }

    public function content(): Content
    {
        return new Content(view: 'emails.support-request');
    }

    /** @return array<int, Attachment> */
    public function attachments(): array
    {
        return $this->screenshot
            ? [Attachment::fromPath($this->screenshot['path'])->as($this->screenshot['name'])->withMime($this->screenshot['mime'])]
            : [];
    }
}
