<?php

namespace App\Domain\Platform;

use App\Models\Backup;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Throwable;

/**
 * HEALTH CHECKS: "is each background part of the system working?"
 * Used by the Super Admin landing page (Services panel, Framer uH0wO9f5O)
 * and later by the System health page (Framer m80KDanOj).
 *
 * Every check answers with a STATUS the screen turns into a coloured pill:
 *   ok              green   (working)
 *   warning         amber   (working, but needs a look)
 *   danger          red     (broken / overdue)
 *   not_configured  grey    (that part isn't built or set up yet, e.g. the ML service before Phase 5)
 *
 * We never pretend: if we can't know something, we say so instead of showing green.
 */
class SystemHealth
{
    /** Cache key the scheduler writes every minute (routes/console.php). A "heartbeat". */
    public const SCHEDULER_HEARTBEAT = 'health:scheduler:last_run_at';

    /** The scheduler's own list of what runs next: [{name, next}] (written with the heartbeat). */
    public const SCHEDULER_NEXT = 'health:scheduler:next';

    /** Backups run every night (02:00); a little slack before we call it overdue. */
    public const BACKUP_OVERDUE_AFTER_HOURS = 25;

    /** The scheduler beats every minute; 5 minutes of silence means it stopped. */
    private const SCHEDULER_LATE_AFTER_MINUTES = 5;

    /** @return array<int, array<string, mixed>> */
    public function services(): array
    {
        return [
            $this->mlService(),
            $this->queue(),
            $this->scheduler(),
            $this->backup(),
        ];
    }

    /** The Python ML microservice (Phase 5). Asked "are you alive?" with a short timeout, cached for a minute. */
    public function mlService(bool $fresh = false): array
    {
        $url = config('services.ml.url');

        if (! $url) {
            return ['key' => 'ml', 'status' => 'not_configured'];
        }

        if ($fresh) {
            Cache::forget('health:ml');
        }

        // [ok, milliseconds], asked at most once a minute (unless "Check now")
        [$healthy, $ms] = Cache::remember('health:ml', 60, function () use ($url) {
            $start = microtime(true);
            try {
                $ok = Http::timeout(2)->get(rtrim($url, '/').'/health')->successful();
            } catch (Throwable) {
                $ok = false; // unreachable counts as down
            }

            return [$ok, (int) round((microtime(true) - $start) * 1000)];
        });

        return ['key' => 'ml', 'status' => $healthy ? 'ok' : 'danger', 'latency_ms' => $ms];
    }

    /** More jobs waiting than this = "Slow" (normally there are only a few). */
    public const QUEUE_SLOW_WHEN_WAITING = 10;

    /** A page that takes longer than this to answer = "Slow". */
    public const WEB_SLOW_AFTER_MS = 1000;

    /** Cache keys the queue worker fills (AppServiceProvider: Queue::after). */
    public const JOBS_DONE_KEY = 'health:jobs:done:';      // + Y-m-d

    public const JOBS_DONE_MS_KEY = 'health:jobs:done_ms:'; // + Y-m-d (total time, for the average)

    /** Background jobs (AI checks, OpenAI summaries, exports): failed, waiting, running, done today. */
    public function queue(): array
    {
        $failed = $this->failedJobCount();
        $failedLastHour = DB::table('failed_jobs')->where('failed_at', '>=', now()->subHour())->count();
        $waiting = DB::table('jobs')->whereNull('reserved_at')->count();
        $running = DB::table('jobs')->whereNotNull('reserved_at')->count();
        $day = now()->toDateString();
        $done = (int) Cache::get(self::JOBS_DONE_KEY.$day, 0);
        $doneMs = (int) Cache::get(self::JOBS_DONE_MS_KEY.$day, 0);

        return [
            'key' => 'queue',
            // warning ("Slow") = a pile-up, or jobs failed recently; old failures alone stay amber too
            'status' => $waiting >= self::QUEUE_SLOW_WHEN_WAITING || $failedLastHour > 0 || $failed > 0 ? 'warning' : 'ok',
            'failed' => $failed,
            'failed_last_hour' => $failedLastHour,
            'waiting' => $waiting,
            'running' => $running,
            'done_today' => $done,
            'avg_ms' => $done > 0 ? (int) round($doneMs / $done) : null,
        ];
    }

    /**
     * The web app & API. From the scheduler (a separate process) it really asks the API over HTTP
     * and times the answer. Inside a web request that would ask the same single-threaded dev server
     * to answer itself (it would wait forever), so there `$overHttp` is false: it shows the LAST
     * check the scheduler recorded (status + time), never a made-up "ok".
     * The address comes from HEALTH_WEB_URL (config/services.php), falling back to APP_URL.
     */
    public function web(bool $overHttp = true): array
    {
        if (! $overHttp) {
            $last = DB::table('health_checks')->where('service', 'web')->latest('id')->first(['status', 'latency_ms']);

            // nothing recorded yet (the scheduler hasn't run): say so instead of guessing
            return [
                'key' => 'web',
                'status' => $last->status ?? 'not_configured',
                'latency_ms' => $last?->latency_ms !== null ? (int) $last->latency_ms : null,
            ];
        }

        $url = rtrim((string) config('services.health.web_url'), '/').'/api/v1/health';
        $start = microtime(true);
        try {
            $ok = Http::timeout(5)->acceptJson()->get($url)->successful();
        } catch (Throwable) {
            $ok = false;
        }
        $ms = (int) round((microtime(true) - $start) * 1000);

        return [
            'key' => 'web',
            'status' => ! $ok ? 'danger' : ($ms > self::WEB_SLOW_AFTER_MS ? 'warning' : 'ok'),
            'latency_ms' => $ms,
        ];
    }

    /** The database: answers? how big? how many connections? (and how full the server's disk is) */
    public function database(): array
    {
        $start = microtime(true);
        try {
            DB::select('SELECT 1');
            $ms = (int) round((microtime(true) - $start) * 1000);
            $size = (int) DB::table('information_schema.tables')->where('table_schema', DB::getDatabaseName())
                ->sum(DB::raw('data_length + index_length'));
            $connections = (int) (DB::selectOne("SHOW STATUS LIKE 'Threads_connected'")->Value ?? 0);
        } catch (Throwable) {
            return ['key' => 'database', 'status' => 'danger', 'latency_ms' => null];
        }

        $total = @disk_total_space(storage_path());
        $free = @disk_free_space(storage_path());

        return [
            'key' => 'database',
            'status' => $ms > self::WEB_SLOW_AFTER_MS ? 'warning' : 'ok',
            'latency_ms' => $ms,
            'size_bytes' => $size,
            'connections' => $connections,
            // the disk the server stores everything on (the database's own limit isn't known)
            'disk_used_pct' => $total ? (int) round((1 - $free / $total) * 100) : null,
            'disk_total_bytes' => $total ? (int) $total : null,
        ];
    }

    public function scheduler(): array
    {
        $lastRun = Cache::get(self::SCHEDULER_HEARTBEAT);

        $status = match (true) {
            $lastRun === null => 'not_configured', // never seen it run (`php artisan schedule:work` isn't running)
            Carbon::parse($lastRun)->lt(now()->subMinutes(self::SCHEDULER_LATE_AFTER_MINUTES)) => 'warning',
            default => 'ok',
        };

        return ['key' => 'scheduler', 'status' => $status, 'last_run_at' => $lastRun ? Carbon::parse($lastRun)->toIso8601String() : null];
    }

    /**
     * Database backups (the `backups` table, Framer TKziMjHUe).
     * not_configured = no good backup yet · danger = the last good one is over 25 h old.
     * `running` = a backup is queued or being made right now.
     */
    public function backup(): array
    {
        $lastSuccess = Backup::succeeded()->max('finished_at');

        $status = match (true) {
            $lastSuccess === null => 'not_configured',
            Carbon::parse($lastSuccess)->lt(now()->subHours(self::BACKUP_OVERDUE_AFTER_HOURS)) => 'danger',
            default => 'ok',
        };

        return [
            'key' => 'backup',
            'status' => $status,
            'last_success_at' => $lastSuccess ? Carbon::parse($lastSuccess)->toIso8601String() : null,
            'running' => Backup::inProgress()->exists(),
        ];
    }

    public function failedJobCount(): int
    {
        return DB::table('failed_jobs')->count();
    }

    /**
     * Short names of the newest failed jobs, e.g. ["RunAnomalyCheck", "GenerateReportSummary"].
     * Laravel stores each job as JSON; "displayName" is the job's class name.
     *
     * @return array<int, string>
     */
    public function failedJobNames(int $limit = 3): array
    {
        return DB::table('failed_jobs')->orderByDesc('failed_at')->limit(20)->pluck('payload')
            ->map(fn ($payload) => class_basename(json_decode($payload, true)['displayName'] ?? 'Unknown job'))
            ->unique()->take($limit)->values()->all();
    }
}
