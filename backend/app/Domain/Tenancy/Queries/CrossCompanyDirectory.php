<?php

namespace App\Domain\Tenancy\Queries;

use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * For an Admin: the people of OTHER companies (clerks / officers / supervisors) who could be invited,
 * and the Admin's open invites + incoming requests.
 *
 * PRIVACY (user decision 2026-11-22): someone who isn't in the Admin's company is shown with their
 * NAME, ROLE and HOME COMPANY only. Never their email, employee ID, department, status or activity.
 * The rows are built here, field by field, so nothing else can slip out.
 */
class CrossCompanyDirectory
{
    public function __construct(private int $companyId) {}

    /** People of other companies with no accepted / pending row for this company (invitable). */
    public function invitable(?string $search, int $perPage = 20)
    {
        $query = User::query()
            ->whereIn('users.role', AccessCandidates::OPERATIONAL_ROLES)
            ->where('users.is_active', true)
            ->whereNotNull('users.company_id')
            ->where('users.company_id', '!=', $this->companyId)
            ->whereHas('company', fn (Builder $c) => $c->where('is_active', true)->whereNull('suspended_at'))
            ->whereNotExists(fn ($e) => $e->from('user_company_access')
                ->whereColumn('user_company_access.user_id', 'users.id')
                ->where('user_company_access.company_id', $this->companyId)
                ->whereIn('user_company_access.granted_status', ['accepted', 'pending']))
            ->with(['company:id,name', 'department:id,name'])
            ->addSelect(['users.*', 'previous' => DB::table('user_company_access')->select('kind')
                ->whereColumn('user_company_access.user_id', 'users.id')
                ->where('user_company_access.company_id', $this->companyId)
                ->where('user_company_access.granted_status', 'denied')->limit(1)]);

        if ($search) {
            $like = '%'.addcslashes($search, '\\%_').'%';
            // name, company or DEPARTMENT (user decision 2026-11-28); never email or employee ID
            $query->where(fn (Builder $q) => $q
                ->where('users.first_name', 'like', $like)
                ->orWhere('users.last_name', 'like', $like)
                ->orWhereRaw("CONCAT(users.first_name, ' ', users.last_name) LIKE ?", [$like])
                ->orWhereHas('company', fn (Builder $c) => $c->where('name', 'like', $like))
                ->orWhereHas('department', fn (Builder $d) => $d->where('name', 'like', $like)->orWhere('code', 'like', $like)));
        }

        $page = $query->orderBy('users.first_name')->orderBy('users.last_name')->paginate($perPage);
        // the department is shown in the invite results too (user decision 2026-11-28)
        $page->getCollection()->transform(fn (User $u) => self::card($u) + [
            'department' => $u->department?->name,
            'previously_declined' => $u->previous !== null,
        ]);

        return $page;
    }

    /** Open invites (waiting for the person) + requests (waiting for this Admin). */
    public function pending(): array
    {
        $rows = DB::table('user_company_access as uca')
            ->join('users', 'users.id', '=', 'uca.user_id')
            ->leftJoin('companies as home', 'home.id', '=', 'users.company_id')
            ->leftJoin('users as asker', 'asker.id', '=', 'uca.requested_by')
            ->where('uca.company_id', $this->companyId)
            ->where('uca.granted_status', 'pending')
            ->whereIn('uca.kind', ['invite', 'request'])
            ->orderByDesc('uca.granted_at')
            ->get([
                'uca.kind', 'uca.message', 'uca.granted_at as asked_at', 'users.id', 'users.first_name', 'users.last_name', 'users.role',
                'users.email', 'users.company_id', 'home.name as home_company',
                DB::raw("TRIM(CONCAT(COALESCE(asker.first_name,''),' ',COALESCE(asker.last_name,''))) as asked_by"),
            ]);

        $map = fn ($r) => [
            'id' => (int) $r->id,
            'first_name' => $r->first_name,
            'last_name' => $r->last_name,
            'full_name' => trim("{$r->first_name} {$r->last_name}"),
            'role' => $r->role,
            'home_company' => (int) $r->company_id === $this->companyId ? null : $r->home_company,
            // their email only if they belong to this company already (privacy rule)
            'email' => (int) $r->company_id === $this->companyId ? $r->email : null,
            'message' => $r->message,
            'asked_at' => $r->asked_at ? Carbon::parse($r->asked_at)->toIso8601String() : null,
            'asked_by' => $r->asked_by ?: null,
        ];

        return [
            'requests' => $rows->where('kind', 'request')->map($map)->values()->all(),
            'invites' => $rows->where('kind', 'invite')->map($map)->values()->all(),
        ];
    }

    /** The limited card of someone from another company. */
    public static function card(User $u): array
    {
        return [
            'id' => $u->id,
            'first_name' => $u->first_name,
            'last_name' => $u->last_name,
            'full_name' => $u->full_name,
            'role' => $u->role,
            'home_company' => $u->company?->name,
        ];
    }
}
