<?php

namespace App\Models;

use App\Domain\Notifications\NotificationType;
use App\Support\LiveCounts;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One in-app notification for ONE person (the bell panel).
 * Table: notifications (recipient_id, title, message, voucher_id, is_read, type).
 *
 * Not to be confused with Laravel's built-in "database notifications"
 * (different columns). This is our own simple table.
 */
class Notification extends Model
{
    protected $fillable = ['recipient_id', 'title', 'message', 'voucher_id', 'is_read', 'type'];

    /** A new, read or deleted notification = that person's cached bell count is out of date (LiveCounts). */
    protected static function booted(): void
    {
        $clear = fn (self $n) => LiveCounts::userChanged($n->recipient_id);

        static::saved($clear);
        static::deleted($clear);
    }

    protected function casts(): array
    {
        return [
            'is_read' => 'boolean',
            'type' => NotificationType::class,
        ];
    }

    /** The voucher it's about (the final-approval notice offers the payment PDF / Email the payee, 2026-11-28). */
    public function voucher(): BelongsTo
    {
        return $this->belongsTo(Voucher::class);
    }

    public function recipient(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recipient_id');
    }

    /** Only the notifications that belong to this user (nobody sees anyone else's). */
    public function scopeFor(Builder $query, User $user): Builder
    {
        return $query->where('recipient_id', $user->id);
    }

    public function scopeUnread(Builder $query): Builder
    {
        return $query->where('is_read', false);
    }
}
