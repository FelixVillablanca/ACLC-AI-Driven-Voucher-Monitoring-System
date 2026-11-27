<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * BudgetChangeRequest <-> `budget_change_requests` (2026-11-27): an allocation edit bigger than the Global
 * setting "budget.change_signoff_above" waits here (status pending) for a Supervisor's sign-off.
 * At most one pending request per allocation.
 */
class BudgetChangeRequest extends Model
{
    protected $fillable = [
        'company_id', 'budget_allocation_id', 'current_budget', 'requested_budget', 'current_alert_pct',
        'requested_alert_pct', 'reason', 'status', 'requested_by', 'decided_by', 'decided_at', 'decision_note',
    ];

    protected function casts(): array
    {
        return [
            'current_budget' => 'decimal:2',
            'requested_budget' => 'decimal:2',
            'current_alert_pct' => 'decimal:2',
            'requested_alert_pct' => 'decimal:2',
            'decided_at' => 'datetime',
        ];
    }

    public function allocation(): BelongsTo
    {
        return $this->belongsTo(BudgetAllocation::class, 'budget_allocation_id');
    }

    public function requester(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by');
    }
}
