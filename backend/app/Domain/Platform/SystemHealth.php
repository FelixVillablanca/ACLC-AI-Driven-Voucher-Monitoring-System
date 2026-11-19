<?php

namespace App\Domain\Platform;

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

    /** Cache key a successful backup will write (backups are set up in Phase 8). */
    public const BACKUP_LAST_SUCCESS = 'health:backup:last_success_at';

    /** Backups should run every 24 h; a little slack before we call it overdue. */
    private const BACKUP_OVERDUE_AFTER_HOURS = 25;

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
    public function mlService(): array
    {
        $url = config('services.ml.url');

        if (! $url) {
            return ['key' => 'ml', 'status' => 'not_configured'];
        }

        $healthy = Cache::remember('health:ml:ok', 60, function () use ($url) {
            try {
                return Http::timeout(2)->get(rtrim($url, '/').'/health')->successful();
            } catch (Throwable) {
                return false; // unreachable counts as down
            }
        });

        return ['key' => 'ml', 'status' => $healthy ? 'ok' : 'danger'];
    }

    /** Background jobs (AI checks, OpenAI summaries, exports): how many failed, how many are waiting. */
    public function queue(): array
    {
        $failed = $this->failedJobCount();

        return [
            'key' => 'queue',
            'status' => $failed > 0 ? 'warning' : 'ok',
            'failed' => $failed,
            'waiting' => DB::table('jobs')->count(),
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

    public function backup(): array
    {
        $lastSuccess = Cache::get(self::BACKUP_LAST_SUCCESS);

        $status = match (true) {
            $lastSuccess === null => 'not_configured',
            Carbon::parse($lastSuccess)->lt(now()->subHours(self::BACKUP_OVERDUE_AFTER_HOURS)) => 'danger',
            default => 'ok',
        };

        return ['key' => 'backup', 'status' => $status, 'last_success_at' => $lastSuccess ? Carbon::parse($lastSuccess)->toIso8601String() : null];
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
