<?php

namespace App\Http\Resources\Payees;

use App\Domain\Vouchers\Support\VoucherNumber;
use App\Models\Payee;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

/**
 * A payee for a clerk (Payees page, Framer jbj8yIDz9). `stats` count only the clerk's OWN vouchers
 * (PayeeDirectory::withStats); money is a DECIMAL string, never a float.
 * ->withDetails(): the side panel (GZb92vr4M): who added it, average a month, usual category, recent vouchers.
 *
 * @mixin Payee
 */
class PayeeResource extends JsonResource
{
    private ?array $details = null;

    public function withDetails(array $details): static
    {
        $this->details = $details;

        return $this;
    }

    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        $data = [
            'id' => $this->id,
            'name' => $this->name,
            'type' => $this->type ? ['id' => $this->type->id, 'name' => $this->type->name] : null,
            'tin' => $this->tin,
            'default_payment_method' => $this->default_payment_method,
            'bank_name' => $this->bank_name,
            'bank_account_number' => $this->bank_account_number,
            'bank_account_name' => $this->bank_account_name,
            'address' => $this->address,
            'email' => $this->email,
            'is_active' => (bool) $this->is_active,
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
            'stats' => [
                'vouchers_count' => (int) ($this->vouchers_count ?? 0),
                'approved_ytd' => bcadd((string) ($this->approved_ytd ?? '0'), '0', 2),
                'last_used_at' => $this->last_used_at ? Carbon::parse($this->last_used_at)->toIso8601String() : null,
            ],
        ];

        if ($this->details === null) {
            return $data;
        }

        return $data + [
            'added_by' => $this->creator?->full_name,
            'avg_per_month' => $this->details['avg_per_month'],
            'usual_category' => $this->details['usual_category'],
            'recent_vouchers' => $this->details['recent']->map(fn ($v) => [
                'id' => $v->id,
                'voucher_number' => VoucherNumber::isDraft($v->voucher_number) ? null : $v->voucher_number,
                'status' => $v->status,
                'amount' => (string) $v->amount,
                'summary' => Str::limit((string) ($v->description ?: $v->purpose), 60) ?: null,
                'at' => Carbon::parse($v->submitted_at ?? $v->created_at)->toIso8601String(),
            ])->all(),
        ];
    }
}
