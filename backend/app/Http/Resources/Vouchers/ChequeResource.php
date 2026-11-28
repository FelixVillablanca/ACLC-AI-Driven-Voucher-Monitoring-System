<?php

namespace App\Http\Resources\Vouchers;

use App\Domain\Vouchers\Cheques\ChequeRules;
use App\Models\Cheque;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * One cheque (cheque register, 2026-11-29). Money as a DECIMAL string. `can` = the next steps THIS person may take
 * (only the clerk who owns the voucher records and moves cheques; reviewers read only).
 *
 * @mixin Cheque
 */
class ChequeResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $isOwner = $request->user()?->role === 'accounting_clerk'
            && $this->relationLoaded('voucher') && (int) $this->voucher?->created_by === (int) $request->user()->id;
        $name = fn ($u) => $u ? trim("{$u->first_name} {$u->last_name}") : null;

        return [
            'id' => $this->id,
            'voucher' => $this->relationLoaded('voucher') && $this->voucher
                ? ['id' => $this->voucher->id, 'number' => $this->voucher->voucher_number] : ['id' => $this->voucher_id, 'number' => null],
            'cheque_number' => $this->cheque_number,
            'cheque_date' => $this->cheque_date->toDateString(),
            'bank_name' => $this->bank_name,
            'amount' => (string) $this->amount,
            'payee_name' => $this->payee_name,
            'status' => $this->status,
            'status_label' => ChequeRules::LABELS[$this->status] ?? $this->status,
            'received_by' => $this->received_by,
            'released_at' => $this->released_at?->toIso8601String(),
            'cleared_on' => $this->cleared_on?->toDateString(),
            'cancelled_at' => $this->cancelled_at?->toIso8601String(),
            'cancel_reason' => $this->cancel_reason,
            'stale_at' => $this->stale_at?->toIso8601String(),
            'stale_on' => ChequeRules::staleOn($this->cheque_date)->toDateString(),
            'days_left' => ChequeRules::daysLeft($this->resource),
            'recorded_by' => $this->relationLoaded('creator') ? $name($this->creator) : null,
            'recorded_at' => $this->created_at?->toIso8601String(),
            'can' => [
                'release' => $isOwner && ChequeRules::can($this->resource, 'released'),
                'clear' => $isOwner && ChequeRules::can($this->resource, 'cleared'),
                'cancel' => $isOwner && ChequeRules::can($this->resource, 'cancelled'),
            ],
        ];
    }
}
