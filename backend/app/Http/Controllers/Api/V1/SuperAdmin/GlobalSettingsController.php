<?php

namespace App\Http\Controllers\Api\V1\SuperAdmin;

use App\Domain\AI\OpenAi\OpenAiSpend;
use App\Domain\Platform\Actions\UpdateGlobalSettings;
use App\Domain\Platform\Queries\SettingsHistory;
use App\Domain\Platform\SystemHealth;
use App\Domain\Platform\SystemSettings;
use App\Http\Controllers\Controller;
use App\Http\Requests\SuperAdmin\SettingsHistoryRequest;
use App\Http\Requests\SuperAdmin\UpdateGlobalSettingsRequest;
use App\Models\Company;
use App\Models\User;
use Illuminate\Http\JsonResponse;

/**
 * The Super Admin's Global settings tab (Framer tsrXCiWWw) with G1 Change history,
 * G2 Discard (screen only: nothing was saved yet) and G3 Save changes.
 */
class GlobalSettingsController extends Controller
{
    public function __construct(private SystemSettings $settings) {}

    /**
     * GET /api/v1/superadmin/settings
     *   data.values  = [key => current value] (the platform default when nothing was saved yet)
     *   data.context = the facts the page shows next to the settings (real numbers only)
     */
    public function show(SystemHealth $health): JsonResponse
    {
        return response()->json(['data' => [
            'values' => $this->settings->all(),
            'context' => [
                'companies' => Company::count(),
                'ml_service' => $health->mlService()['status'], // ok | danger | not_configured
                // OpenAI spend isn't tracked until report summaries exist (Phase 5)
                'openai_spent_this_month_usd' => app(OpenAiSpend::class)->thisMonth(), // report summaries (since 2026-11-27)
                'admins' => [
                    'active' => User::where('role', 'admin')->where('is_active', true)->count(),
                    'without_two_factor' => User::where('role', 'admin')->where('is_active', true)
                        ->where(fn ($q) => $q->whereNull('two_factor_confirmed_at')->orWhereNull('two_factor_secret'))->count(),
                ],
                // Data & backups: set in the server's configuration (config/backup.php), shown read-only
                'backups' => ['nightly_at' => config('backup.nightly_at'), 'keep' => (int) config('backup.keep')],
                'last_saved' => $this->settings->lastChange(),
            ],
        ]]);
    }

    /** PUT /api/v1/superadmin/settings  (see UpdateGlobalSettingsRequest) */
    public function update(UpdateGlobalSettingsRequest $request, UpdateGlobalSettings $update): JsonResponse
    {
        $result = $update->handle(
            $request->user(),
            $request->changes(),
            $request->validated('reason'),
            $request->boolean('notify_admins'),
            $request->ip(),
        );

        return response()->json([
            'data' => ['values' => $this->settings->all(), 'last_saved' => $this->settings->lastChange()],
            'meta' => $result,
        ]);
    }

    /** GET /api/v1/superadmin/settings/history?group=&page=  (G1 Change history, newest first) */
    public function history(SettingsHistoryRequest $request, SettingsHistory $history): JsonResponse
    {
        $page = $history->page($request->validated('group'));

        return response()->json([
            'data' => $page->items(),
            'meta' => [
                'current_page' => $page->currentPage(),
                'last_page' => $page->lastPage(),
                'total' => $page->total(),
                'counts' => $history->counts(),
            ],
        ]);
    }
}
