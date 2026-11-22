<?php

use App\Domain\Platform\Health\RecordHealthChecks;
use App\Domain\Platform\SystemHealth;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

/*
| SCHEDULER HEARTBEAT: every minute the scheduler writes "I ran at <time>".
| The Super Admin's Services panel reads it: no heartbeat for 5 minutes = the
| scheduler stopped (so the monthly forecast and daily budget checks wouldn't run).
| Locally the scheduler only runs while `php artisan schedule:work` is open.
*/
Schedule::call(function () {
    Cache::forever(SystemHealth::SCHEDULER_HEARTBEAT, now()->toIso8601String());
    // what runs next (System health, Scheduler card): only the scheduler itself knows its list
    Cache::forever(SystemHealth::SCHEDULER_NEXT, collect(Schedule::events())
        ->map(fn ($event) => ['name' => $event->description, 'next' => $event->nextRunDate()->toIso8601String()])
        ->filter(fn ($e) => ! in_array($e['name'], ['scheduler-heartbeat', 'health-checks'], true))
        ->sortBy('next')->values()->all());
})
    ->everyMinute()
    ->name('scheduler-heartbeat');

/*
| HEALTH CHECKS (System health tab, Framer m80KDanOj): every minute each service is checked and
| the result saved (`health_checks`), which gives the uptime %, the 30-day strip and the queue
| chart. Three bad checks in a row open an incident (DetectIncidents). Kept 90 days.
*/
Schedule::call(fn () => app(RecordHealthChecks::class)->handle())
    ->everyMinute()
    ->name('health-checks')
    ->withoutOverlapping(5);

Schedule::call(fn () => RecordHealthChecks::prune())
    ->dailyAt('03:30')
    ->name('prune-health-checks');

/*
| NIGHTLY DATABASE BACKUP (Framer TKziMjHUe): every night at 02:00 a backup is queued,
| and the queue worker (`php artisan queue:work`, started by dev.ps1) makes it.
| Keeps the newest 7 good backups (config/backup.php).
*/
Schedule::command('backup:run')
    ->dailyAt(config('backup.nightly_at'))
    ->name('nightly-database-backup');
