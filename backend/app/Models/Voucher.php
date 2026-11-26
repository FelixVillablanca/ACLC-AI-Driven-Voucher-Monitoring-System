<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

/**
 * Voucher <-> `vouchers`. Read-only use for now (the clerk dashboard); creating, editing and moving
 * vouchers between statuses comes with Phase 3. Money is DECIMAL, never float ('decimal:2').
 */
class Voucher extends Model
{
    protected $guarded = ['*'];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'ai_anomaly_flag' => 'boolean',
            'submitted_at' => 'datetime',
            'approved_at' => 'datetime',
        ];
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(VoucherCategory::class, 'category_id');
    }

    public function payee(): BelongsTo
    {
        return $this->belongsTo(Payee::class);
    }

    public function approvals(): HasMany
    {
        return $this->hasMany(VoucherApproval::class);
    }

    /** The reviewer's most recent "send it back" (Returned to me: who, which step, the note, when). */
    public function latestReturn(): HasOne
    {
        return $this->hasOne(VoucherApproval::class)->ofMany(['id' => 'max'], fn ($q) => $q->where('action', 'returned'));
    }
}
