<?php

namespace App\Domain\Audit\Queries;

use App\Domain\Audit\AuditCatalog;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * QUERY CLASS for the Super Admin's Audit logs tab (Framer EJ0asP2ZH, AL2–AL6, AL9).
 *
 * Filters (all optional, combined with AND):
 *   search      person (name / email), IP address, record ("#212"), or an email in the entry
 *   companies   company ids, plus "platform" for entries with no company
 *   actions     action keys (the AL4 groups expand to these on the screen)
 *   from / to   whole days, in the app's time zone (Asia/Manila)
 *   sensitive   only the ⚑ actions
 *
 * Read-only on purpose: nothing here can change or delete an entry.
 */
class AuditLogSearch
{
    /** @param  array{search?: ?string, companies?: array, actions?: array, from?: ?string, to?: ?string, sensitive?: bool}  $f */
    public function filtered(array $f, array $skip = []): Builder
    {
        $q = DB::table('audit_logs');

        if (! in_array('search', $skip, true) && ($search = trim((string) ($f['search'] ?? ''))) !== '') {
            $this->search($q, $search);
        }

        if (! in_array('companies', $skip, true) && ! empty($f['companies'])) {
            $ids = array_values(array_filter($f['companies'], fn ($c) => $c !== 'platform'));
            $platform = in_array('platform', $f['companies'], true);
            $q->where(fn (Builder $w) => $w
                ->when($ids, fn (Builder $x) => $x->orWhereIn('audit_logs.company_id', $ids))
                ->when($platform, fn (Builder $x) => $x->orWhereNull('audit_logs.company_id')));
        }

        if (! in_array('actions', $skip, true) && ! empty($f['actions'])) {
            $q->whereIn('audit_logs.action', $f['actions']);
        }

        if (! empty($f['from'])) {
            $q->where('audit_logs.created_at', '>=', Carbon::parse($f['from'])->startOfDay());
        }
        if (! empty($f['to'])) {
            $q->where('audit_logs.created_at', '<=', Carbon::parse($f['to'])->endOfDay());
        }

        if (! empty($f['sensitive'])) {
            $q->whereIn('audit_logs.action', AuditCatalog::sensitiveActions());
        }

        return $q;
    }

    /** Newest first, with who did it (joined once for the whole page). */
    public function page(array $f, int $perPage = 25, int $page = 1)
    {
        return $this->filtered($f)
            ->leftJoin('users', 'users.id', '=', 'audit_logs.user_id')
            ->leftJoin('companies', 'companies.id', '=', 'audit_logs.company_id')
            ->orderByDesc('audit_logs.created_at')->orderByDesc('audit_logs.id')
            ->select(['audit_logs.*', 'users.first_name as user_first_name', 'users.last_name as user_last_name',
                'users.email as user_email', 'users.role as user_role', 'companies.name as company_name'])
            ->paginate($perPage, ['*'], 'page', $page);
    }

    /**
     * The numbers in the AL3 company list and AL4 action groups. Each facet ignores its OWN filter
     * (so you can see what you'd get by ticking another company) but follows all the others.
     */
    public function facets(array $f): array
    {
        $companies = $this->filtered($f, ['companies'])
            ->selectRaw('COALESCE(audit_logs.company_id, 0) as c, COUNT(*) as n')->groupBy('c')->pluck('n', 'c');
        $actions = $this->filtered($f, ['actions'])
            ->selectRaw('audit_logs.action as a, COUNT(*) as n')->groupBy('a')->pluck('n', 'a');

        $groups = [];
        foreach ($actions as $action => $n) {
            $group = AuditCatalog::describe($action)['group'];
            $groups[$group] = ($groups[$group] ?? 0) + (int) $n;
        }

        return [
            'companies' => collect($companies)->mapWithKeys(fn ($n, $c) => [(int) $c === 0 ? 'platform' : (string) $c => (int) $n])->all(),
            'groups' => $groups,
            'actions' => collect($actions)->map(fn ($n) => (int) $n)->all(),
        ];
    }

    /** The 4 cards (always the whole platform, never filtered). */
    public function summary(): array
    {
        $today = Carbon::today();
        $logs = fn () => DB::table('audit_logs');

        $failed24h = $logs()->where('action', 'login_failed')->where('created_at', '>=', now()->subDay());
        $topIp = (clone $failed24h)->whereNotNull('ip_address')
            ->selectRaw('ip_address, COUNT(*) as n')->groupBy('ip_address')->orderByDesc('n')->first();

        return [
            'events_today' => $logs()->where('created_at', '>=', $today)->count(),
            'companies_today' => $logs()->where('created_at', '>=', $today)->whereNotNull('company_id')->distinct()->count('company_id'),
            'sensitive_7d' => $logs()->where('created_at', '>=', now()->subDays(7))->whereIn('action', AuditCatalog::sensitiveActions())->count(),
            'failed_sign_ins_24h' => (clone $failed24h)->count(),
            'top_failed_ip' => $topIp && $topIp->n > 1 ? ['ip' => $topIp->ip_address, 'count' => (int) $topIp->n] : null,
            'oldest_entry_at' => ($oldest = $logs()->min('created_at')) ? Carbon::parse($oldest)->toIso8601String() : null,
            'total' => $logs()->count(),
        ];
    }

    /**
     * Search: a person's name or email, an IP address, "#212" (a record id), or text inside the
     * entry (e.g. the email typed on a failed sign-in).
     */
    private function search(Builder $q, string $search): void
    {
        $like = '%'.addcslashes($search, '\%_').'%';

        $q->where(function (Builder $w) use ($search, $like) {
            if (preg_match('/^#?(\d+)$/', $search, $m)) {
                $w->orWhere('audit_logs.record_id', (int) $m[1])->orWhere('audit_logs.id', (int) $m[1]);
            }
            $w->orWhere('audit_logs.ip_address', 'like', $like)
                ->orWhereIn('audit_logs.user_id', fn (Builder $u) => $u->select('id')->from('users')
                    ->where(fn (Builder $x) => $x
                        ->whereRaw("CONCAT(first_name, ' ', last_name) LIKE ?", [$like])
                        ->orWhere('email', 'like', $like)))
                // the person something was done TO (users #48), e.g. "maria lopez"
                ->orWhere(fn (Builder $x) => $x->where('audit_logs.table_name', 'users')
                    ->whereIn('audit_logs.record_id', fn (Builder $u) => $u->select('id')->from('users')
                        ->where(fn (Builder $y) => $y
                            ->whereRaw("CONCAT(first_name, ' ', last_name) LIKE ?", [$like])
                            ->orWhere('email', 'like', $like))))
                ->orWhere('audit_logs.new_values', 'like', $like);
        });
    }
}
