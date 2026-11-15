<?php

use App\Exceptions\ApiErrorRenderer;
use App\Http\Middleware\AssignRequestId;
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
