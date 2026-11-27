<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * BudgetAllocation <-> `budget_allocations`: ONE yearly budget per department per fiscal year (since 2026-11-27).
 * Money is DECIMAL (strings in PHP, never floats). used_amount grows when a voucher of the department gets its
 * FINAL approval (Domain/Budgets/Actions/ConsumeBudget, row locked).
 */
class BudgetAllocation extends Model
{
    protected $fillable = [
        'company_id', 'department_id', 'fiscal_year', 'total_budget', 'used_amount', 'alert_threshold_pct',
        'alert_sent_at', 'created_by', 'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'fiscal_year' => 'integer',
            'total_budget' => 'decimal:2',
            'used_amount' => 'decimal:2',
            'alert_threshold_pct' => 'decimal:2',
            'alert_sent_at' => 'datetime',
        ];
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    public function changeRequests(): HasMany
    {
        return $this->hasMany(BudgetChangeRequest::class);
    }

    /** Usage in whole percent, e.g. 92 (0 when the budget is 0). */
    public function usedPct(?string $used = null): float
    {
        return self::pct($used ?? (string) $this->used_amount, (string) $this->total_budget);
    }

    public static function pct(string $part, string $whole, int $scale = 0): float
    {
        return bccomp($whole, '0', 2) > 0 ? (float) bcdiv(bcmul($part, '100', 4), $whole, $scale) : 0.0;
    }
}
