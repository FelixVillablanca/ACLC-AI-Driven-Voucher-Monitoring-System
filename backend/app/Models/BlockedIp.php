<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One block of an IP address (table `blocked_ips`, Framer AL8). Rows are never deleted:
 * an unblock fills unblocked_at, so the history stays.
 */
class BlockedIp extends Model
{
    protected $fillable = ['ip_address', 'reason', 'expires_at', 'blocked_by'];

    protected function casts(): array
    {
        return ['expires_at' => 'datetime', 'unblocked_at' => 'datetime', 'watch_until' => 'datetime'];
    }

    /** Still in force: not unblocked, and not expired. */
    public function scopeActive(Builder $query): Builder
    {
        return $query->whereNull('unblocked_at')
            ->where(fn (Builder $q) => $q->whereNull('expires_at')->orWhere('expires_at', '>', now()));
    }

    public function blockedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'blocked_by');
    }
}
