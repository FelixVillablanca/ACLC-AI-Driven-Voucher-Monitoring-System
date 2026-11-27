<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * VoucherApproval <-> `voucher_approvals`: one reviewer decision on a voucher
 * (step 1 = Accounting Officer, step 2 = Supervisor; action approved | rejected | returned | noted).
 */
class VoucherApproval extends Model
{
    protected $guarded = ['*'];

    protected function casts(): array
    {
        return ['needs_changes' => 'array'];
    }

    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approver_id');
    }
}
