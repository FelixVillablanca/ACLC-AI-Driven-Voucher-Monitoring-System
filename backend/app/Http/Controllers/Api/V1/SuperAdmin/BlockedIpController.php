<?php

namespace App\Http\Controllers\Api\V1\SuperAdmin;

use App\Domain\Security\Actions\BlockIpAddress;
use App\Domain\Security\Actions\UnblockIpAddress;
use App\Http\Controllers\Controller;
use App\Http\Requests\SuperAdmin\BlockIpRequest;
use App\Http\Requests\SuperAdmin\UnblockIpRequest;
use App\Models\BlockedIp;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Blocked IP addresses: Audit logs AL2 / AL8, System health "Blocked addresses" + SH8 / SH9.
 */
class BlockedIpController extends Controller
{
    /** GET /api/v1/superadmin/blocked-ips  (the active blocks, newest first) */
    public function index(): JsonResponse
    {
        return response()->json(['data' => BlockedIp::active()->with('blockedBy:id,first_name,last_name')->latest('id')->get()
            ->map(fn (BlockedIp $b) => $this->present($b, withEvidence: true))->all()]);
    }

    /** GET /api/v1/superadmin/blocked-ips/{block}  (SH9: why it was blocked, and is it still trying?) */
    public function show(BlockedIp $block): JsonResponse
    {
        return response()->json(['data' => $this->present($block->load('blockedBy:id,first_name,last_name'), withEvidence: true)]);
    }

    /** POST /api/v1/superadmin/blocked-ips  { ip_address, duration, reason, notify_accounts } */
    public function store(BlockIpRequest $request, BlockIpAddress $block): JsonResponse
    {
        $result = $block->handle(
            $request->user(),
            $request->validated('ip_address'),
            $request->validated('duration'),
            $request->validated('reason'),
            $request->boolean('notify_accounts'),
            $request->ip(),
        );

        return response()->json([
            'data' => $this->present($result['block']->load('blockedBy:id,first_name,last_name')),
            'meta' => ['accounts_emailed' => $result['accounts_emailed']],
        ], 201);
    }

    /** POST /api/v1/superadmin/blocked-ips/{block}/unblock  { watch } */
    public function unblock(UnblockIpRequest $request, BlockedIp $block, UnblockIpAddress $unblock): JsonResponse
    {
        return response()->json(['data' => $this->present(
            $unblock->handle($request->user(), $block, $request->ip(), $request->boolean('watch')),
        )]);
    }

    private function present(BlockedIp $b, bool $withEvidence = false): array
    {
        $data = [
            'id' => $b->id,
            'ip_address' => $b->ip_address,
            'reason' => $b->reason,
            'until' => $b->expires_at?->toIso8601String(), // null = until unblocked
            'by' => $b->blockedBy?->full_name, // null = blocked automatically
            'automatic' => $b->blocked_by === null,
            'unblocked_at' => $b->unblocked_at?->toIso8601String(),
            'watch_until' => $b->watch_until?->toIso8601String(),
            'created_at' => $b->created_at?->toIso8601String(),
        ];

        if (! $withEvidence) {
            return $data;
        }

        $logs = fn () => DB::table('audit_logs')->where('ip_address', $b->ip_address);
        $before = [$b->created_at->copy()->subDay(), $b->created_at];
        $refused = $logs()->where('action', 'login_blocked')->where('created_at', '>=', $b->created_at);

        return [
            ...$data,
            // the 24 hours before the block
            'before' => [
                'failed' => $logs()->where('action', 'login_failed')->whereBetween('created_at', $before)->count(),
                'accounts' => $logs()->where('action', 'login_failed')->whereBetween('created_at', $before)
                    ->pluck('new_values')->map(fn ($v) => json_decode((string) $v, true)['email'] ?? null)->filter()->unique()->count(),
                'successful' => $logs()->where('action', 'login')->whereBetween('created_at', $before)->count(),
            ],
            // still knocking while blocked?
            'refused_since' => (clone $refused)->count(),
            'last_refused_at' => ($at = (clone $refused)->max('created_at')) ? Carbon::parse($at)->toIso8601String() : null,
        ];
    }
}
