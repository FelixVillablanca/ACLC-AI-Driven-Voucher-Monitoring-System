<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One database backup run. Created by App\Domain\Platform\Backups\StartBackup,
 * carried out by the queued job App\Jobs\RunDatabaseBackup.
 */
class Backup extends Model
{
    protected $fillable = [
        'status', 'trigger', 'requested_by', 'notify_requester', 'file_path', 'size_bytes',
        'database_size_bytes', 'started_at', 'finished_at', 'error',
    ];

    protected function casts(): array
    {
        return [
            'notify_requester' => 'boolean',
            'size_bytes' => 'integer',
            'database_size_bytes' => 'integer',
            'started_at' => 'datetime',
            'finished_at' => 'datetime',
        ];
    }

    public function requester(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by');
    }

    /** Waiting for the worker, or being made right now. */
    public function scopeInProgress(Builder $query): Builder
    {
        return $query->whereIn('status', ['queued', 'running']);
    }

    public function scopeSucceeded(Builder $query): Builder
    {
        return $query->where('status', 'succeeded');
    }

    /** How long it took, in seconds (null until it finished). */
    public function durationSeconds(): ?int
    {
        return $this->started_at && $this->finished_at ? (int) $this->started_at->diffInSeconds($this->finished_at) : null;
    }
}
