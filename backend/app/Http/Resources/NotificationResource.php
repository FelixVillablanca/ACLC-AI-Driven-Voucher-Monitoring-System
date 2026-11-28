<?php

namespace App\Http\Resources;

use App\Models\Notification;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * One notification as JSON for the bell panel.
 *
 * @mixin Notification
 */
class NotificationResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'type' => $this->type->value,
            'category' => $this->type->category(),
            'title' => $this->title,
            'message' => $this->message,
            'voucher_id' => $this->voucher_id,
            'is_read' => $this->is_read,
            'created_at' => $this->created_at?->toIso8601String(),
            'actions' => $this->actions(),
        ];
    }

    /**
     * Buttons on the notice (2026-11-28): the clerk's FINAL-approval notice (made when the voucher was approved, so
     * not the earlier "passed Accounting" one) offers the payment PDF, and "Email the payee" when it has an email.
     *
     * @return list<string>
     */
    private function actions(): array
    {
        $v = $this->relationLoaded('voucher') ? $this->voucher : null;
        if ($this->type->value !== 'voucher_approved' || ! $v || $v->status !== 'approved' || ! $v->approved_at
            || (int) $v->created_by !== (int) $this->recipient_id || $this->created_at?->lt($v->approved_at)) {
            return [];
        }

        return $v->payee_email ? ['payment_pdf', 'email_payee'] : ['payment_pdf'];
    }
}
