<?php

use App\Exceptions\ApiErrorRenderer;
use App\Http\Middleware\AssignRequestId;
use App\Http\Middleware\EnforceIdleTimeout;
use App\Http\Middleware\EnsureAccountInGoodStanding;
use App\Http\Middleware\EnsureUserHasRole;
use App\Http\Middleware\ForceJsonResponse;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Runs on EVERY request (even unknown URLs), so every response has a tracking number
        $middleware->prepend(AssignRequestId::class);

        // Runs on every /api request
        $middleware->api(prepend: [ForceJsonResponse::class]);
        // Sanctum SPA login: requests from the React app (SANCTUM_STATEFUL_DOMAINS)
        // get a session cookie + CSRF protection, so no token is stored in the browser.
        $middleware->statefulApi();
        // Short names for route middleware: ->middleware('role:admin')
        $middleware->alias([
            'role' => EnsureUserHasRole::class,
            'account.standing' => EnsureAccountInGoodStanding::class, // deactivated / company suspended -> signed out now
            'idle.timeout' => EnforceIdleTimeout::class,              // Super Admins: signed out after 15 idle minutes
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*'),
        );

        // Every API error uses the same JSON shape (see app/Exceptions/ApiErrorRenderer.php)
        $exceptions->render(function (Throwable $e, Request $request) {
            return $request->is('api/*') ? ApiErrorRenderer::render($e, $request) : null;
        });
    })->create();
