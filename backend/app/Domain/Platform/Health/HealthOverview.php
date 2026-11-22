<?php

namespace App\Domain\Platform\Health;

use App\Domain\Platform\FailedJobs;
use App\Domain\Platform\SystemHealth;
use App\Models\Backup;
use App\Models\Incident;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * QUERY CLASS for the System health tab (Framer m80KDanOj): the 6 service cards (checked live),
 * the 30-day uptime strip and day details (SH7), the jobs that need a look, the 24-hour queue
 * chart (SH4) and recent incidents, all from REAL measurements (`health_checks`).
 * A number we can't know yet is null, and the screen says so.
 */
class HealthOverview
{
    public const UPTIME_DAYS = 30;

    public function __construct(private SystemHealth $health, private FailedJobs $failedJobs) {}

    public function services(): array
    {
        $web = $this->health->web(overHttp: false);
        $web['uptime_30d'] = $this->uptimePercent('web');
        // how many checks the % is based on: a young number (a few checks) moves a lot with each new one
        $web['uptime_checks'] = DB::table('health_checks')->where('service', 'web')
            ->where('checked_at', '>=', now()->subDays(self::UPTIME_DAYS))->count();
        $web['latency_ms'] = $this->averageLatency('web', 60) ?? $web['latency_ms'];

        $scheduler = $this->health->scheduler();
        $scheduler['next'] = array_slice((array) Cache::get(SystemHealth::SCHEDULER_NEXT, []), 0, 3);

        $backup = $this->health->backup();
        $last = Backup::succeeded()->latest('finished_at')->first();
        $backup['last_size_bytes'] = $last?->size_bytes;
        $backup['nightly_at'] = config('backup.nightly_at');
        $backup['current'] = ($running = Backup::inProgress()->latest('id')->first())
            ? ['id' => $running->id, 'status' => $running->status, 'started_at' => $running->started_at?->toIso8601String()
                ?? $running->created_at?->toIso8601String(), 'requested_by' => $running->requested_by]
            : null;

        return [
            'web' => $web,
            'database' => $this->health->database(),
            'queue' => $this->health->queue(),
            'scheduler' => $scheduler,
            'ml' => $this->health->mlService(),
            'backup' => $backup,
        ];
    }

    /** Share of checks that were healthy over the last 30 days (null = nothing recorded yet). */
    public function uptimePercent(string $service): ?float
    {
        $row = DB::table('health_checks')->where('service', $service)->where('checked_at', '>=', now()->subDays(self::UPTIME_DAYS))
            ->selectRaw("COUNT(*) as total, SUM(status = 'ok') as good")->first();

        return $row && $row->total > 0 ? round($row->good / $row->total * 100, 2) : null;
    }

    private function averageLatency(string $service, int $minutes): ?int
    {
        $avg = DB::table('health_checks')->where('service', $service)->where('checked_at', '>=', now()->subMinutes($minutes))->avg('latency_ms');

        return $avg !== null ? (int) round($avg) : null;
    }

    /**
     * The 30-day strip: one entry per day for the web app.
     *   ok · slow (some checks slow) · down (some checks failed) · no_data (nothing recorded that day)
     */
    public function uptimeDays(): array
    {
        $rows = DB::table('health_checks')->where('service', 'web')
            ->where('checked_at', '>=', now()->subDays(self::UPTIME_DAYS - 1)->startOfDay())
            ->selectRaw("DATE(checked_at) as d, COUNT(*) as total, SUM(status = 'warning') as slow, SUM(status = 'danger') as down")
            ->groupBy('d')->get()->keyBy('d');

        $days = [];
        for ($i = self::UPTIME_DAYS - 1; $i >= 0; $i--) {
            $date = now()->subDays($i)->toDateString();
            $r = $rows[$date] ?? null;
            $days[] = [
                'date' => $date,
                'status' => match (true) {
                    $r === null => 'no_data',
                    $r->down > 0 => 'down',
                    $r->slow > 0 => 'slow',
                    default => 'ok',
                },
                // each check covers one minute, so "bad checks" ≈ minutes
                'bad_minutes' => $r ? (int) $r->slow + (int) $r->down : 0,
                'checks' => $r ? (int) $r->total : 0,
            ];
        }

        return $days;
    }

    /** SH7: what happened on one day: the unhealthy stretches of each service, and incidents. */
    public function day(string $date): array
    {
        $start = Carbon::parse($date)->startOfDay();
        $end = $start->copy()->endOfDay();

        $checks = DB::table('health_checks')->whereBetween('checked_at', [$start, $end])->orderBy('checked_at')
            ->get(['service', 'status', 'latency_ms', 'checked_at']);

        $stretches = [];
        foreach ($checks->groupBy('service') as $service => $rows) {
            $current = null;
            foreach ($rows as $row) {
                $bad = in_array($row->status, ['warning', 'danger'], true);
                if ($bad && $current === null) {
                    $current = ['service' => $service, 'from' => $row->checked_at, 'to' => $row->checked_at, 'worst' => $row->status, 'latency' => []];
                }
                if ($bad) {
                    $current['to'] = $row->checked_at;
                    $current['worst'] = $row->status === 'danger' ? 'danger' : $current['worst'];
                    $current['latency'][] = $row->latency_ms;
                }
                if (! $bad && $current !== null) {
                    $stretches[] = $current;
                    $current = null;
                }
            }
            if ($current !== null) {
                $stretches[] = $current;
            }
        }

        $normal = $checks->where('service', 'web')->where('status', 'ok')->avg('latency_ms');

        return [
            'date' => $start->toDateString(),
            'checks' => $checks->where('service', 'web')->count(),
            'normal_latency_ms' => $normal !== null ? (int) round($normal) : null,
            'stretches' => collect($stretches)->map(fn ($s) => [
                'service' => $s['service'],
                'status' => $s['worst'],
                'from' => Carbon::parse($s['from'])->toIso8601String(),
                'to' => Carbon::parse($s['to'])->toIso8601String(),
                'minutes' => Carbon::parse($s['from'])->diffInMinutes(Carbon::parse($s['to'])) + 1,
                'avg_latency_ms' => ($l = array_filter($s['latency'], fn ($v) => $v !== null)) ? (int) round(array_sum($l) / count($l)) : null,
            ])->values()->all(),
            'incidents' => Incident::where('started_at', '<=', $end)
                ->where(fn ($q) => $q->whereNull('resolved_at')->orWhere('resolved_at', '>=', $start))
                ->get()->map(fn (Incident $i) => $this->incidentSummary($i))->all(),
        ];
    }

    /** SH4: the Background jobs panel. */
    public function jobs(): array
    {
        $since = now()->subDay();
        $hours = DB::table('health_checks')->where('service', 'queue')->where('checked_at', '>=', $since)
            ->orderBy('checked_at')->get(['metrics', 'checked_at'])
            ->groupBy(fn ($r) => Carbon::parse($r->checked_at)->format('Y-m-d H:00'))
            ->map(fn ($rows, $hour) => [
                'hour' => Carbon::parse($hour)->toIso8601String(),
                'waiting' => (int) $rows->max(fn ($r) => (json_decode((string) $r->metrics, true)['waiting'] ?? 0)),
            ])->values()->all();

        return [
            'queue' => $this->health->queue(),
            'hours' => $hours,
            'retrying' => $this->retrying(),
            'failed' => $this->failedJobs->list(),
        ];
    }

    /** Jobs that failed once and wait for another try (still in `jobs`, attempts > 0). */
    public function retrying(): array
    {
        return DB::table('jobs')->where('attempts', '>', 0)->orderBy('available_at')->limit(20)
            ->get(['id', 'payload', 'attempts', 'available_at', 'reserved_at'])
            ->map(function ($row) {
                $payload = json_decode($row->payload, true) ?? [];

                return [
                    'id' => $row->id,
                    'name' => Str::headline(class_basename($payload['displayName'] ?? 'Unknown job')),
                    'attempts' => (int) $row->attempts,
                    'max_tries' => $payload['maxTries'] ?? null,
                    'next_try_at' => $row->reserved_at ? null : Carbon::createFromTimestamp($row->available_at)->toIso8601String(),
                    'running' => $row->reserved_at !== null,
                ];
            })->all();
    }

    public function incidents(int $limit = 5): array
    {
        return Incident::orderByRaw("status = 'resolved'")->latest('started_at')->limit($limit)->get()
            ->map(fn (Incident $i) => $this->incidentSummary($i))->all();
    }

    public function incidentSummary(Incident $i): array
    {
        return [
            'id' => $i->id,
            'code' => $i->code,
            'service' => $i->service,
            'title' => $i->title,
            'status' => $i->status,
            'severity' => $i->severity,
            'started_at' => $i->started_at->toIso8601String(),
            'recovered_at' => $i->recovered_at?->toIso8601String(),
            'resolved_at' => $i->resolved_at?->toIso8601String(),
            'minutes' => (int) $i->started_at->diffInMinutes($i->recovered_at ?? $i->resolved_at ?? now()),
        ];
    }

    public function lastCheckedAt(): ?string
    {
        $at = DB::table('health_checks')->max('checked_at');

        return $at ? Carbon::parse($at)->toIso8601String() : null;
    }
}
