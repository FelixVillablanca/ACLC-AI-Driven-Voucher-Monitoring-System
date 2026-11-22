<?php

namespace App\Domain\Platform\Health;

use App\Domain\Platform\SystemHealth;
use App\Models\Incident;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * THE INCIDENT RULES (System health SH10), applied after every round of checks:
 *
 *   1. A service is unhealthy (warning or danger) for 3 checks IN A ROW  → open an incident
 *      and tell every Super Admin. (One bad minute is noise; three is a pattern.)
 *   2. An open incident's service is healthy again                       → "Watching"
 *   3. A watched incident's service goes bad again                       → open again
 *   4. A Super Admin closes it with a note (ResolveIncident)             → "Resolved"
 *
 * "not_configured" (a part that isn't set up yet, like the ML service before Phase 5) is never
 * an incident. Every step is added to the incident's timeline.
 */
class DetectIncidents
{
    public const BAD_CHECKS_IN_A_ROW = 3;

    private const LABELS = [
        'web' => 'Web app & API', 'database' => 'Database', 'queue' => 'Background jobs',
        'scheduler' => 'Scheduler', 'ml' => 'ML service', 'backup' => 'Backups',
    ];

    /** @param  array<string, array<string, mixed>>  $results  service => latest check */
    public function evaluate(array $results): void
    {
        foreach ($results as $service => $result) {
            $status = $result['status'];
            if ($status === 'not_configured') {
                continue;
            }

            $current = Incident::where('service', $service)->whereIn('status', ['open', 'watching'])->latest('id')->first();
            $bad = self::isBad($service, $status, $result);

            if ($current === null && $bad && $this->badInARow($service)) {
                $this->open($service, $status, $result);
            } elseif ($current?->status === 'open' && ! $bad) {
                $current->status = 'watching';
                $current->recovered_at = now();
                $current->addToTimeline(self::LABELS[$service].' is working normally again');
                $current->save();
            } elseif ($current?->status === 'watching' && $bad) {
                $current->status = 'open';
                $current->recovered_at = null;
                $current->addToTimeline('It went wrong again while being watched');
                $current->save();
            }
        }
    }

    private function badInARow(string $service): bool
    {
        $last = DB::table('health_checks')->where('service', $service)
            ->orderByDesc('checked_at')->orderByDesc('id')->limit(self::BAD_CHECKS_IN_A_ROW)->get(['status', 'metrics']);

        return $last->count() === self::BAD_CHECKS_IN_A_ROW
            && $last->every(fn ($row) => self::isBad($service, $row->status, (array) json_decode((string) $row->metrics, true)));
    }

    /**
     * Is this check a problem RIGHT NOW? For background jobs an old failed job waiting for a look
     * keeps the card amber, but only a pile-up or failures in the last hour count as an incident.
     */
    public static function isBad(string $service, string $status, array $result): bool
    {
        if ($service === 'queue') {
            return ($result['waiting'] ?? 0) >= SystemHealth::QUEUE_SLOW_WHEN_WAITING
                || ($result['failed_last_hour'] ?? 0) > 0;
        }

        return in_array($status, ['warning', 'danger'], true);
    }

    private function open(string $service, string $status, array $result): void
    {
        $label = self::LABELS[$service];
        $title = $status === 'danger' ? "{$label} not working" : "{$label} slow";
        // the oldest of the last 3 checks (MIN() would ignore the LIMIT, so take the rows first)
        $firstBad = DB::table('health_checks')->where('service', $service)
            ->orderByDesc('checked_at')->limit(self::BAD_CHECKS_IN_A_ROW)->pluck('checked_at')->min();

        $incident = new Incident([
            'service' => $service,
            'title' => $title,
            'status' => 'open',
            'severity' => $status,
            'started_at' => $firstBad ?? now(),
        ]);
        $incident->addToTimeline('First unhealthy check', $firstBad);
        $incident->addToTimeline('Spotted automatically: '.self::BAD_CHECKS_IN_A_ROW.' unhealthy checks in a row. Super Admins were alerted');
        $incident->save();

        User::where('role', 'super_admin')->where('is_active', true)->pluck('id')
            ->each(fn (int $id) => Notification::create([
                'recipient_id' => $id,
                'type' => 'system_alert',
                'title' => "Incident {$incident->code}: {$title}",
                'message' => "{$label} has been unhealthy for ".self::BAD_CHECKS_IN_A_ROW.' checks in a row. See System health.',
            ]));
    }
}
