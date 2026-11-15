<?php

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

    // Phase 1+: auth routes, then protected routes (auth:sanctum + company) go here.
});
