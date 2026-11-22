<?php

namespace App\Domain\Platform\Health;

use App\Domain\Platform\SystemHealth;
use Illuminate\Support\Facades\DB;

/**
 * Checks every service ONCE and writes one `health_checks` row per service, then lets the
 * incident rules look at the result (DetectIncidents).
 *
 * Runs every minute from the scheduler (routes/console.php), and when a Super Admin presses
 * "↻ Check now" (SH1). From the scheduler the web app is checked over real HTTP; from a click
 * it isn't (see SystemHealth::web()).
 */
class RecordHealthChecks
{
    /** Order of the cards on the page. */
    public const SERVICES = ['web', 'database', 'queue', 'scheduler', 'ml', 'backup'];

    public function __construct(private SystemHealth $health, private DetectIncidents $incidents) {}

    /** @return array<string, array<string, mixed>> service => check result */
    public function handle(bool $fromScheduler = true): array
    {
        $results = [
            'web' => $this->health->web(overHttp: $fromScheduler),
            'database' => $this->health->database(),
            'queue' => $this->health->queue(),
            'scheduler' => $this->health->scheduler(),
            'ml' => $this->health->mlService(fresh: ! $fromScheduler),
            'backup' => $this->health->backup(),
        ];

        // "Check now" can't really test the web app from inside a web request (see SystemHealth::web),
        // so it doesn't write a web row: only real checks from the scheduler count toward uptime.
        $recorded = $fromScheduler ? $results : collect($results)->except('web')->all();

        $now = now();
        DB::table('health_checks')->insert(collect($recorded)->map(fn (array $r, string $service) => [
            'service' => $service,
            'status' => $r['status'],
            'latency_ms' => $r['latency_ms'] ?? null,
            'metrics' => json_encode(collect($r)->except(['key', 'status', 'latency_ms'])->all()),
            'checked_at' => $now,
        ])->values()->all());

        $this->incidents->evaluate($recorded);

        return $results;
    }

    /** Measurements older than 90 days aren't needed (incidents and the audit log keep the history). */
    public static function prune(): int
    {
        return DB::table('health_checks')->where('checked_at', '<', now()->subDays(90))->delete();
    }
}
