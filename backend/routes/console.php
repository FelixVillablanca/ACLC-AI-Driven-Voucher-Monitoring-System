<?php

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
Schedule::call(fn () => Cache::forever(SystemHealth::SCHEDULER_HEARTBEAT, now()->toIso8601String()))
    ->everyMinute()
    ->name('scheduler-heartbeat');
