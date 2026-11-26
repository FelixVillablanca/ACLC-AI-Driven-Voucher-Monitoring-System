<?php

namespace App\Http\Resources\Vouchers;

use App\Domain\Vouchers\Support\DraftExpiry;
use App\Domain\Vouchers\Support\ReturnNote;
use App\Domain\Vouchers\Support\VoucherCompleteness;
use App\Domain\Vouchers\Support\VoucherNumber;
use App\Models\Voucher;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Arr;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * A voucher for its creator (the clerk). Money is a string with 2 decimals (DECIMAL), never a float.
 * `voucher_number` is null while it's a draft (the temporary DRAFT-… value is never shown).
 * With ->detailed(): line items, the reviewers' history (who, step, action, note, when) and
 * what the clerk may do now (can_edit / can_submit / can_cancel).
 *
 * @mixin Voucher
 */
class VoucherResource extends JsonResource
{
    private bool $detailed = false;

    public function detailed(): static
    {
        $this->detailed = true;

        return $this;
    }

    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        $editable = in_array($this->status, ['draft', 'returned'], true);
        $lineCount = isset($this->line_count) ? (int) $this->line_count
            : DB::table('voucher_line_items')->where('voucher_id', $this->id)->count();

        $base = [
            'id' => $this->id,
            'voucher_number' => VoucherNumber::isDraft($this->voucher_number) ? null : $this->voucher_number,
            'status' => $this->status,
            'payee_name' => $this->payee_name,
            'category' => $this->category ? ['id' => $this->category->id, 'name' => $this->category->name] : null,
            'amount' => (string) $this->amount,
            'currency' => $this->currency,
            'priority' => $this->priority,
            'ai_flagged' => (bool) $this->ai_anomaly_flag,
            'submitted_at' => $this->submitted_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
            // Drafts cards (2026-11-25): what it's for, its size, how ready it is and when it would be deleted
            'summary' => Str::limit((string) ($this->description ?: $this->purpose), 140) ?: null,
            'line_count' => $lineCount,
            'completeness' => $editable ? Arr::except(VoucherCompleteness::check($this->resource, $lineCount), 'errors') : null,
            'expires_at' => DraftExpiry::expiresAt($this->resource)?->toIso8601String(),
            'can_delete' => DraftExpiry::isExpiring($this->resource),
            // Returned to me (2026-11-26): the reviewer's latest send-back; null unless status is returned
            'returned' => ReturnNote::for($this->resource, $this->detailed),
        ];

        if (! $this->detailed) {
            return $base;
        }

        return $base + [
            'voucher_type_id' => $this->voucher_type_id,
            'payee_type_id' => $this->payee_type_id,
            'payee_id' => $this->payee_id,
            'department_id' => $this->department_id,
            'payment_method' => $this->payment_method,
            'bank_name' => $this->bank_name,
            'bank_account_number' => $this->bank_account_number,
            'bank_account_name' => $this->bank_account_name,
            'description' => $this->description,
            'purpose' => $this->purpose,
            'reference_number' => $this->reference_number,
            'due_date' => $this->due_date,
            'names' => [
                'voucher_type' => $this->voucher_type_id ? DB::table('voucher_types')->where('id', $this->voucher_type_id)->value('name') : null,
                'payee_type' => $this->payee_type_id ? DB::table('payee_types')->where('id', $this->payee_type_id)->value('name') : null,
                'department' => $this->department_id ? DB::table('departments')->where('id', $this->department_id)->value('name') : null,
            ],
            'line_items' => DB::table('voucher_line_items')->where('voucher_id', $this->id)->orderBy('sort_order')->orderBy('id')
                ->get(['id', 'description', 'quantity', 'unit', 'unit_price', 'total_price'])
                ->map(fn ($l) => [
                    'id' => $l->id, 'description' => $l->description, 'quantity' => (string) $l->quantity, 'unit' => $l->unit,
                    'unit_price' => (string) $l->unit_price, 'total_price' => (string) $l->total_price,
                ])->all(),
            'history' => DB::table('voucher_approvals as a')
                ->leftJoin('users as u', 'u.id', '=', 'a.approver_id')
                ->where('a.voucher_id', $this->id)->orderBy('a.created_at')->orderBy('a.id')
                ->get(['a.step', 'a.role_at_time', 'a.action', 'a.remarks', 'a.created_at', 'u.first_name', 'u.last_name'])
                ->map(fn ($a) => [
                    'step' => (int) $a->step, 'role' => $a->role_at_time, 'action' => $a->action, 'remarks' => $a->remarks,
                    'by' => trim("{$a->first_name} {$a->last_name}") ?: null,
                    'at' => $a->created_at ? Carbon::parse($a->created_at)->toIso8601String() : null,
                ])->all(),
            'can' => ['edit' => $editable, 'submit' => $editable, 'cancel' => $editable, 'delete' => DraftExpiry::isExpiring($this->resource)],
        ];
    }
}
