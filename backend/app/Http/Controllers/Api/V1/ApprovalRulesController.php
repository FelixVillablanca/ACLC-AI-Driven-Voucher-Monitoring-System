<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Platform\SystemSettings;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;

/**
 * GET /api/v1/approval-rules: the CURRENT approval rules, for the "How vouchers get approved" page.
 * Any signed-in user may read them (they're the same for everyone). `live` says whether reviewers can
 * act on vouchers yet: false until the approval inbox is built (Phase 4), so the page can say so.
 */
class ApprovalRulesController extends Controller
{
    public function __invoke(SystemSettings $settings): JsonResponse
    {
        $default = fn (string $key) => SystemSettings::DEFAULTS[$key]['value'];

        return response()->json(['data' => [
            'high_value_threshold' => (string) $settings->get(SystemSettings::HIGH_VALUE_THRESHOLD, $default(SystemSettings::HIGH_VALUE_THRESHOLD)),
            'ai_flagged_needs_step2' => (bool) $settings->get(SystemSettings::AI_FLAGGED_NEEDS_STEP_2, $default(SystemSettings::AI_FLAGGED_NEEDS_STEP_2)),
            'submitting_live' => true,
            'reviewing_live' => false,
        ]]);
    }
}
