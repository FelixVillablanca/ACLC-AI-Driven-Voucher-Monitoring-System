<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One suspicious event (or a burst of them) that the Super Admins should look at.
 * Shared by all Super Admins: the review status is the same for everyone.
 * Created only by App\Domain\Security\Actions\RaiseSecurityAlert.
 */
class SecurityAlert extends Model
{
    public const TYPE_FAILED_SIGN_INS = 'failed_sign_ins';

    public const TYPE_NEW_DEVICE = 'new_device_sign_in';

    public const TYPE_PASSWORD_CHANGED = 'password_changed';

    public const TYPE_SUPER_ADMIN_ADDED = 'super_admin_added';

    protected $fillable = [
        'type', 'severity', 'status', 'user_id', 'subject_email', 'ip_address', 'device',
        'event_count', 'first_seen_at', 'last_seen_at', 'details', 'reviewed_by', 'reviewed_at',
    ];

    protected function casts(): array
    {
        return [
            'details' => 'array',
            'event_count' => 'integer',
            'first_seen_at' => 'datetime',
            'last_seen_at' => 'datetime',
            'reviewed_at' => 'datetime',
        ];
    }

    /** The account the alert is about (null = the typed email doesn't belong to anyone). */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    /** "Not reviewed" */
    public function scopeOpen(Builder $query): Builder
    {
        return $query->where('status', 'open');
    }

    /** "Reviewed" tab: reviewed or dismissed */
    public function scopeClosed(Builder $query): Builder
    {
        return $query->whereIn('status', ['reviewed', 'dismissed']);
    }

    public function isOpen(): bool
    {
        return $this->status === 'open';
    }
}
