<?php

namespace App\Http\Controllers\Api\V1\SuperAdmin;

use App\Domain\Platform\FailedJobs;
use App\Domain\Platform\Health\HealthOverview;
use App\Domain\Platform\Health\RecordHealthChecks;
use App\Domain\Platform\Health\ResolveIncident;
use App\Exceptions\ApiException;
use App\Http\Controllers\Controller;
use App\Http\Requests\SuperAdmin\ResolveIncidentRequest;
use App\Models\Incident;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Carbon;
use Throwable;

/**
 * The Super Admin's System health tab (Framer m80KDanOj) and SH1–SH10.
 * Run backup (SH2/SH3) and Retry failed (SH6) use their existing endpoints.
 */
class SystemHealthController extends Controller
{
    public function __construct(private HealthOverview $overview, private FailedJobs $failedJobs) {}

    /** GET /api/v1/superadmin/system-health  (the whole page; refreshed every 60 s) */
    public function show(): JsonResponse
    {
        return response()->json(['data' => $this->page()]);
    }

    /**
     * POST /api/v1/superadmin/system-health/check  (SH1 "↻ Check now")
     * Checks every service right now (the ML service skips its 1-minute cache) and saves the result.
     */
    public function check(RecordHealthChecks $record): JsonResponse
    {
        $record->handle(fromScheduler: false);

        return response()->json(['data' => $this->page()]);
    }

    /** GET /api/v1/superadmin/system-health/days/{date}  (SH7 one day of the uptime strip) */
    public function day(string $date): JsonResponse
    {
        try {
            $day = Carbon::createFromFormat('!Y-m-d', $date);
        } catch (Throwable) {
            $day = null;
        }
        if (! $day || $day->format('Y-m-d') !== $date || $day->isAfter(today()) || $day->lt(today()->subDays(HealthOverview::UPTIME_DAYS))) {
            throw new ApiException('Pick a day from the last 30 days.', 'INVALID_DAY', 422);
        }

        return response()->json(['data' => $this->overview->day($date)]);
    }

    /** GET /api/v1/superadmin/system-health/jobs  (SH4 Background jobs panel) */
    public function jobs(): JsonResponse
    {
        return response()->json(['data' => $this->overview->jobs()]);
    }

    /** GET /api/v1/superadmin/system-health/failed-jobs/{uuid}  (SH5 Job details) */
    public function failedJob(string $uuid, FailedJobs $failed): JsonResponse
    {
        return response()->json(['data' => $failed->detail($uuid)]);
    }

    /** GET /api/v1/superadmin/system-health/incidents/{incident}  (SH10) */
    public function incident(Incident $incident): JsonResponse
    {
        return response()->json(['data' => $this->incidentDetail($incident)]);
    }

    /** POST /api/v1/superadmin/system-health/incidents/{incident}/resolve  { note } */
    public function resolve(ResolveIncidentRequest $request, Incident $incident, ResolveIncident $resolve): JsonResponse
    {
        $incident = $resolve->handle($incident, $request->user(), $request->validated('note'), $request->ip());

        return response()->json(['data' => $this->incidentDetail($incident)]);
    }

    private function page(): array
    {
        $services = $this->overview->services();

        return [
            'services' => $services,
            'attention' => collect($services)->filter(fn ($s) => in_array($s['status'], ['warning', 'danger'], true))->keys()->values()->all(),
            'checked_at' => $this->overview->lastCheckedAt(),
            'uptime' => ['percent' => $services['web']['uptime_30d'], 'days' => $this->overview->uptimeDays()],
            'retrying' => $this->overview->retrying(),
            'failed' => $this->failedJobs->list(), // "Jobs that need a look"
            'incidents' => $this->overview->incidents(),
        ];
    }

    private function incidentDetail(Incident $i): array
    {
        return [
            ...$this->overview->incidentSummary($i->loadMissing('resolvedBy:id,first_name,last_name')),
            'timeline' => $i->timeline ?? [],
            'closing_note' => $i->closing_note,
            'resolved_by' => $i->resolvedBy?->full_name,
        ];
    }
}
