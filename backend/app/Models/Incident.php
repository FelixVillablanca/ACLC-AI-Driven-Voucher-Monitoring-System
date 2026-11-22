<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Something went wrong with a service for a while (System health, Framer SH10).
 * Opened by DetectIncidents, closed by a Super Admin with a note (ResolveIncident).
 * `code` = "INC-014" (from the id).
 */
class Incident extends Model
{
    protected $fillable = ['service', 'title', 'status', 'severity', 'started_at'];

    protected function casts(): array
    {
        return [
            'started_at' => 'datetime',
            'recovered_at' => 'datetime',
            'resolved_at' => 'datetime',
            'timeline' => 'array',
        ];
    }

    public function getCodeAttribute(): string
    {
        return 'INC-'.str_pad((string) $this->id, 3, '0', STR_PAD_LEFT);
    }

    public function addToTimeline(string $text, mixed $at = null): void
    {
        $this->timeline = [...($this->timeline ?? []), [
            'at' => Carbon::parse($at ?? now())->toIso8601String(),
            'text' => $text,
        ]];
    }

    public function resolvedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'resolved_by');
    }
}
