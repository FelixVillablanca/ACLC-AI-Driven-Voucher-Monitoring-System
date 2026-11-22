<?php

namespace App\Domain\Platform\Health;

use App\Domain\Audit\AuditTrail;
use App\Exceptions\ApiException;
use App\Models\Incident;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * "✓ Mark resolved" (SH10). A closing note is required: what fixed it, and what to do differently.
 * The incident stays in the history; nothing is deleted.
 */
class ResolveIncident
{
    public function handle(Incident $incident, User $by, string $note, ?string $ip): Incident
    {
        return DB::transaction(function () use ($incident, $by, $note, $ip) {
            $incident = Incident::whereKey($incident->id)->lockForUpdate()->firstOrFail();
            if ($incident->status === 'resolved') {
                throw new ApiException("{$incident->code} is already resolved.", 'INCIDENT_ALREADY_RESOLVED', 409);
            }

            $incident->status = 'resolved';
            $incident->resolved_at = now();
            $incident->resolved_by = $by->id;
            $incident->closing_note = $note;
            $incident->recovered_at ??= now();
            $incident->addToTimeline("Marked resolved by {$by->full_name}");
            $incident->save();

            AuditTrail::record([
                'user_id' => $by->id,
                'action' => 'incident_resolved',
                'table_name' => 'incidents',
                'record_id' => $incident->id,
                'new_values' => ['code' => $incident->code, 'title' => $incident->title, 'note' => $note],
                'ip_address' => $ip,
            ]);

            return $incident;
        });
    }
}
