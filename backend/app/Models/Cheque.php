<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Cheque <-> `cheques` (cheque register, 2026-11-29): one cheque written for an approved cheque voucher.
 * Status and its rules live in App\Domain\Vouchers\Cheques\ChequeRules; changes go through ManageCheques.
 */
class Cheque extends Model
{
    protected $guarded = ['*'];

    protected function casts(): array
    {
        return [
            'cheque_date' => 'date',
            'amount' => 'decimal:2',
            'released_at' => 'datetime',
            'cleared_on' => 'date',
            'cancelled_at' => 'datetime',
            'stale_warned_at' => 'datetime',
            'stale_at' => 'datetime',
        ];
    }

    public function voucher(): BelongsTo
    {
        return $this->belongsTo(Voucher::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
