<?php

namespace App\Domain\Platform;

use App\Domain\Audit\AuditTrail;
use App\Exceptions\ApiException;
use App\Jobs\RunDatabaseBackup;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * FAILED BACKGROUND JOBS ("Retry failed jobs", Framer fzdOvPqCX).
 *
 * When a queued job gives up, Laravel moves it to the `failed_jobs` table with its data
 * and the error. From there it can be:
 *   - retried:  put back in the queue (Laravel's `queue:retry`), and the worker tries again
 *   - deleted:  removed for good (it will never run)
 *
 * CATALOG below = what we know about each kind of job: a friendly name, which service it
 * depends on (so the window can say "ML service: Operational now"), and whether retrying
 * it makes sense. Unknown jobs still show up, with a name made from their class.
 */
class FailedJobs
{
    /** Most failed jobs listed at once (the dashboard count shows the real total). */
    public const LIST_LIMIT = 50;

    /**
     * @var array<class-string, array{label: string, service: ?string, retryable: bool, note?: string}>
     */
    private const CATALOG = [
        RunDatabaseBackup::class => [
            'label' => 'Database backup',
            'service' => null,
            // The backup it belonged to is already marked failed, so running the old job again does nothing
            'retryable' => false,
            'note' => 'Start a new backup instead (Run backup now).',
        ],
        // Phase 5 adds the AI jobs here, e.g. RunAnomalyCheck => ['label' => 'AI anomaly check', 'service' => 'ml', …]
    ];

    public function __construct(private SystemHealth $health) {}

    /** @return array{jobs: array<int, array<string, mixed>>, total: int, services: array<string, string>} */
    public function list(): array
    {
        $rows = DB::table('failed_jobs')->orderByDesc('failed_at')->orderByDesc('id')->limit(self::LIST_LIMIT)->get();
        $jobs = $rows->map(fn ($row) => $this->describe($row))->all();

        // Status of each service the listed jobs depend on (only those)
        $services = [];
        foreach (array_unique(array_filter(array_column($jobs, 'service'))) as $service) {
            $services[$service] = match ($service) {
                'ml' => $this->health->mlService()['status'],
                default => 'unknown',
            };
        }

        return ['jobs' => $jobs, 'total' => DB::table('failed_jobs')->count(), 'services' => $services];
    }

    /**
     * Puts the chosen jobs back in the queue. All-or-nothing check first: an unknown id → 404,
     * a job that can't be retried → 409, so nothing half-happens.
     *
     * @param  array<int, string>  $ids  failed_jobs.uuid values
     */
    public function retry(array $ids, User $by, ?string $ip): int
    {
        $rows = $this->rowsOrFail($ids);

        $blocked = $rows->map(fn ($row) => $this->describe($row))->where('retryable', false);
        if ($blocked->isNotEmpty()) {
            throw new ApiException(
                $blocked->first()['name'].' can’t be retried. '.($blocked->first()['note'] ?? ''),
                'JOB_NOT_RETRYABLE',
                409,
            );
        }

        Artisan::call('queue:retry', ['id' => $rows->pluck('uuid')->all()]);
        $this->audit('failed_jobs_retried', $rows, $by, $ip);

        return $rows->count();
    }

    /** Removes the chosen jobs for good. */
    public function delete(array $ids, User $by, ?string $ip): int
    {
        $rows = $this->rowsOrFail($ids);

        DB::table('failed_jobs')->whereIn('uuid', $rows->pluck('uuid'))->delete();
        $this->audit('failed_jobs_deleted', $rows, $by, $ip);

        return $rows->count();
    }

    /**
     * SH5 Job details: the row plus the first lines of the error (server paths removed) and the
     * job's saved settings. 404 when it's gone (retried or deleted meanwhile).
     */
    public function detail(string $uuid): array
    {
        $row = DB::table('failed_jobs')->where('uuid', $uuid)->first();
        if (! $row) {
            throw new ApiException('This job isn’t in the failed list any more (retried or deleted).', 'JOB_NOT_FOUND', 404);
        }
        $payload = json_decode($row->payload, true) ?? [];
        $lines = collect(preg_split('/\R/', (string) $row->exception))->take(6)
            // "C:\xampp\…\app\Jobs\Dump.php:42" → "Dump.php:42" (never show server folders)
            ->map(fn ($l) => preg_replace('~\S*[/\\\\]([^/\\\\\s]+:\d+)~', '$1', trim($l)))
            ->filter()->values()->all();

        return [
            ...$this->describe($row),
            'connection' => $row->connection,
            'class' => $payload['displayName'] ?? null,
            'timeout' => $payload['timeout'] ?? null,
            'backoff' => $payload['backoff'] ?? null,
            'error_lines' => $lines,
        ];
    }

    /** One row as the window shows it. The error is ONE line, with server file paths removed. */
    public function describe(object $row): array
    {
        $payload = json_decode($row->payload, true) ?? [];
        $class = $payload['displayName'] ?? 'Unknown job';
        $known = self::CATALOG[$class] ?? null;

        return [
            'id' => $row->uuid,
            'name' => $known['label'] ?? Str::headline(class_basename($class)),
            'subject' => $this->subject($class, $payload),
            'error' => $this->shortError($row->exception),
            'queue' => $row->queue,
            'max_tries' => $payload['maxTries'] ?? null,
            'failed_at' => Carbon::parse($row->failed_at)->toIso8601String(),
            'service' => $known['service'] ?? null,
            'retryable' => $known['retryable'] ?? true,
            'note' => $known['note'] ?? null,
        ];
    }

    /** "Backup #17" — read from the job's saved fields without rebuilding the object. */
    private function subject(string $class, array $payload): ?string
    {
        $command = $payload['data']['command'] ?? '';

        if ($class === RunDatabaseBackup::class && preg_match('/"backupId";i:(\d+)/', $command, $m)) {
            return 'Backup #'.$m[1];
        }

        return null;
    }

    /** "RuntimeException: mysqldump failed in C:\xampp\…\Dump.php:42 \n Stack trace…" → "mysqldump failed" */
    private function shortError(string $exception): string
    {
        $first = Str::of($exception)->before("\n")->trim();
        $message = Str::of($first)->after(': ')->value() ?: $first->value();
        $message = preg_replace('/ in [A-Za-z]?:?[\\\\\/][^\s]+:\d+$/', '', $message);

        return Str::limit($message, 160);
    }

    /** @return Collection<int, object> */
    private function rowsOrFail(array $ids)
    {
        $rows = DB::table('failed_jobs')->whereIn('uuid', $ids)->get();
        if ($rows->count() !== count(array_unique($ids))) {
            throw new ApiException('Some of these jobs are gone already (retried or deleted). Refresh the list.', 'JOB_NOT_FOUND', 404);
        }

        return $rows;
    }

    private function audit(string $action, $rows, User $by, ?string $ip): void
    {
        AuditTrail::record([
            'user_id' => $by->id,
            'company_id' => null, // platform-level
            'action' => $action,
            'table_name' => 'failed_jobs',
            'record_id' => null,
            'old_values' => null,
            'new_values' => json_encode([
                'count' => $rows->count(),
                'jobs' => $rows->map(fn ($row) => ['uuid' => $row->uuid, 'job' => json_decode($row->payload, true)['displayName'] ?? null])->all(),
            ]),
            'ip_address' => $ip,
            'user_agent' => null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
}
