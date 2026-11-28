<?php

namespace App\Providers;

use App\Domain\Platform\SystemHealth;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Queue\Events\JobProcessed;
use Illuminate\Queue\Events\JobProcessing;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Str;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->configureRateLimiting();
        $this->countFinishedJobs();
    }

    /**
     * "Done today · avg 4 s each" on System health (Background jobs). Laravel deletes a job once it
     * has run, so the queue worker counts them as they finish (per day, in the cache).
     */
    private function countFinishedJobs(): void
    {
        $started = [];
        Queue::before(function (JobProcessing $event) use (&$started) {
            $started[$event->job->getJobId()] = microtime(true);
        });
        Queue::after(function (JobProcessed $event) use (&$started) {
            $day = now()->toDateString();
            $ms = (int) round((microtime(true) - ($started[$event->job->getJobId()] ?? microtime(true))) * 1000);
            unset($started[$event->job->getJobId()]);
            Cache::add(SystemHealth::JOBS_DONE_KEY.$day, 0, now()->addDays(2));
            Cache::add(SystemHealth::JOBS_DONE_MS_KEY.$day, 0, now()->addDays(2));
            Cache::increment(SystemHealth::JOBS_DONE_KEY.$day);
            Cache::increment(SystemHealth::JOBS_DONE_MS_KEY.$day, $ms);
        });
    }

    /**
     * RATE LIMITING = "how many tries per minute". It stops robots from
     * guessing passwords (brute force). Over the limit -> 429 Too Many Requests.
     */
    private function configureRateLimiting(): void
    {
        // Login: 5 tries per minute for each email + computer (IP) pair
        RateLimiter::for('login', fn (Request $request) => Limit::perMinute(5)->by(
            Str::lower((string) $request->input('email')).'|'.$request->ip()
        ));

        // Two-step codes: 6 tries per minute per browser session (and per IP), so 6-digit codes can't be guessed
        RateLimiter::for('two-factor', fn (Request $request) => [
            Limit::perMinute(6)->by('two-factor|'.($request->hasSession() ? $request->session()->getId() : '').'|'.$request->ip()),
            Limit::perMinute(30)->by('two-factor-ip|'.$request->ip()),
        ]);

        // "Set your password" links: 10 tries per minute per computer, so tokens can't be guessed
        RateLimiter::for('invitation', fn (Request $request) => Limit::perMinute(10)->by('invitation|'.$request->ip()));

        // Super Admin area: stricter, 60 requests per minute per Super Admin (spec §4.6).
        // A stolen Super Admin session can't be used to scrape or hammer the platform quickly.
        // Admin top-bar search (asks while the Admin types, debounced): 60/min per Admin
        RateLimiter::for('admin-search', fn (Request $request) => Limit::perMinute(60)->by('admin-search|'.$request->user()?->id));
        // "Email the payee" (2026-11-28): its OWN counter. A plain throttle:6,1 shares one counter with every other
        // unnamed throttle of the same user, so the clerk's saves / submits would use it up.
        RateLimiter::for('email-payee', fn (Request $request) => Limit::perMinute(6)->by('email-payee|'.$request->user()?->id));
        RateLimiter::for('superadmin', fn (Request $request) => Limit::perMinute(60)->by('superadmin|'.$request->user()?->id));

        // Everything else in the API: 120 requests per minute per user (or IP for guests)
        RateLimiter::for('api', fn (Request $request) => Limit::perMinute(120)->by(
            $request->user()?->id ?: $request->ip()
        ));
    }
}
