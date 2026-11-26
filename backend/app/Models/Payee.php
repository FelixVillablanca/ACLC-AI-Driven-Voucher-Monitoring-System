<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Payee <-> `payees` (2026-11-26): a person or business a company pays. One list per company, kept by its
 * clerks. Vouchers may point at one (vouchers.payee_id); the name on the voucher is a copy.
 */
class Payee extends Model
{
    protected $guarded = ['*'];

    protected function casts(): array
    {
        return ['is_active' => 'boolean', 'deactivated_at' => 'datetime'];
    }

    public function type(): BelongsTo
    {
        return $this->belongsTo(PayeeType::class, 'payee_type_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
