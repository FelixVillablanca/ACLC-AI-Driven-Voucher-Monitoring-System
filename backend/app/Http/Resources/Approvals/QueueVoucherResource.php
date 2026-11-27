<?php

namespace App\Http\Resources\Approvals;

use App\Domain\Approvals\Support\ApprovalRoute;
use App\Models\Voucher;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * One row of the review queue (Framer vZeEe5_Hq): voucher · payee, a hint line (category + why it stands
 * out), clerk "Juan D." · department, amount (DECIMAL string), AI check, how long it has waited (+ SLA state).
 *
 * @mixin Voucher
 */
class QueueVoucherResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        /** @var ApprovalRoute $route */
        $route = app(ApprovalRoute::class);
        $reasons = $route->step2Reasons($this->resource);

        return [
            'id' => $this->id,
            'voucher_number' => $this->voucher_number,
            'payee_name' => $this->payee_name,
            'category' => $this->category?->name,
            'amount' => (string) $this->amount,
            'clerk' => [
                'name' => trim("{$this->clerk_first} {$this->clerk_last}") ?: null,
                'short' => $this->clerk_first ? $this->clerk_first.($this->clerk_last ? ' '.mb_substr($this->clerk_last, 0, 1).'.' : '') : null,
            ],
            'department' => $this->department_name,
            'ai' => [
                'flagged' => (bool) $this->ai_anomaly_flag,
                'score' => $this->ai_anomaly_score !== null ? (string) $this->ai_anomaly_score : null,
                'reason' => $this->ai_anomaly_reason,
                'source' => $this->ai_check_source, // 'rules' (automatic check) | 'model' (Phase 5)
            ],
            'high_value' => in_array('high_value', $reasons, true),
            'needs_supervisor' => $reasons !== [],
            'resubmitted' => (bool) $this->was_returned,
            'submitted_at' => $this->submitted_at?->toIso8601String(),
            'sla' => $route->slaState($this->submitted_at),
        ];
    }
}
