<?php

namespace App\Domain\Identity\Account;

use App\Domain\Audit\AuditCatalog;
use App\Domain\Audit\AuditDescriber;
use App\Domain\Security\Support\DeviceLabel;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * "My activity": the audit log, limited to what THIS person did (or what happened to their sign-in).
 * Read-only, newest first, 20 per page.
 *   type=security  sign-ins, failed sign-ins, password and two-step changes, signed-out devices
 *   type=changes   everything else (accounts created, settings changed, exports…)
 */
class OwnActivity
{
    private const PER_PAGE = 20;

    public function __construct(private AuditDescriber $describer) {}

    public function page(User $user, string $type, int $page): array
    {
        $query = DB::table('audit_logs')->where('user_id', $user->id);
        $security = AuditCatalog::actionsIn('security');

        if ($type === 'security') {
            $query->whereIn('action', $security);
        } elseif ($type === 'changes') {
            $query->whereNotIn('action', $security);
        }

        $result = $query->orderByDesc('id')->paginate(self::PER_PAGE, ['*'], 'page', $page);
        $rows = collect($result->items());
        $described = collect($this->describer->describeMany($rows))->keyBy('id');

        $since = now()->subDays(30);

        return [
            'data' => $rows->map(function ($row) use ($described) {
                $entry = AuditCatalog::describe($row->action);

                return [
                    ...$described->get($row->id),
                    'action' => $row->action,
                    'label' => $entry['label'],
                    'tone' => $entry['tone'],
                    'group' => $entry['group'],
                    'device' => DeviceLabel::from($row->user_agent),
                ];
            })->values()->all(),
            'meta' => [
                'current_page' => $result->currentPage(),
                'last_page' => $result->lastPage(),
                'total' => $result->total(),
                'per_page' => self::PER_PAGE,
            ],
            // the 3 small numbers above the list (last 30 days)
            'summary' => [
                'sign_ins_30d' => DB::table('audit_logs')->where('user_id', $user->id)->where('action', 'login')->where('created_at', '>=', $since)->count(),
                'failed_30d' => DB::table('audit_logs')->where('action', 'login_failed')->where('created_at', '>=', $since)
                    ->where(fn ($q) => $q->where('user_id', $user->id)->orWhere('new_values->email', strtolower($user->email)))->count(),
                'changes_30d' => DB::table('audit_logs')->where('user_id', $user->id)->whereNotIn('action', $security)->where('created_at', '>=', $since)->count(),
            ],
        ];
    }
}
