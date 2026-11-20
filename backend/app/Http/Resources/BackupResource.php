<?php

namespace App\Http\Resources;

use App\Models\Backup;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * One backup run. The file's location on disk is NOT sent: the browser never needs it.
 *
 * @mixin Backup
 */
class BackupResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'status' => $this->status,
            'trigger' => $this->trigger,
            'requested_by' => $this->requester ? ['id' => $this->requester->id, 'full_name' => $this->requester->full_name] : null,
            'size_bytes' => $this->size_bytes,
            'created_at' => $this->created_at?->toIso8601String(),
            'started_at' => $this->started_at?->toIso8601String(),
            'finished_at' => $this->finished_at?->toIso8601String(),
            'duration_seconds' => $this->durationSeconds(),
            // A short, safe reason for the screen (the full error stays in the log)
            'error' => $this->status === 'failed' ? $this->error : null,
        ];
    }
}
