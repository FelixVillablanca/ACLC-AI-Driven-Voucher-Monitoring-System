<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Throwable;

/**
 * HEALTH CHECK: a tiny endpoint that answers "am I OK?".
 * The frontend uses it to show "backend connected", and later
 * UptimeRobot will call it every 5 minutes to warn us if the site is down.
 */
class HealthController extends Controller
{
    public function __invoke(): JsonResponse
    {
        try {
            DB::select('select 1');
            $database = 'ok';
        } catch (Throwable) {
            $database = 'down';
        }

        $healthy = $database === 'ok';

        return response()->json([
            'data' => [
                'status' => $healthy ? 'ok' : 'degraded',
                'database' => $database,
                'version' => 'v1',
                'time' => now()->toIso8601String(),
            ],
        ], $healthy ? 200 : 503);
    }
}
