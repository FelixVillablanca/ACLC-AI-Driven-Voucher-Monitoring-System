<?php

use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\HealthController;
use Illuminate\Support\Facades\Route;

/*
| API routes: the "front door" the React app talks to.
| Every URL here automatically starts with /api, and we group everything under /v1:
|   GET /api/v1/health
| A future breaking change would go under /v2, so v1 keeps working.
*/

Route::prefix('v1')->name('api.v1.')->group(function () {
    // Public: "is the backend alive and can it reach the database?"
    Route::get('/health', HealthController::class)->name('health');

    // Public: log in (max 5 tries per minute, see AppServiceProvider)
    Route::post('/auth/login', [AuthController::class, 'login'])
        ->middleware('throttle:login')
        ->name('auth.login');

    // Logged-in users only. auth:sanctum = "must have a valid session cookie (or token)"
    Route::middleware(['auth:sanctum', 'throttle:api'])->group(function () {
        Route::get('/auth/me', [AuthController::class, 'me'])->name('auth.me');
        Route::post('/auth/logout', [AuthController::class, 'logout'])->name('auth.logout');

        // Next: company-scoped routes (ResolveCompany middleware) go here.
    });
});
