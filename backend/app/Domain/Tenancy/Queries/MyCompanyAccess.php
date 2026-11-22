<?php

namespace App\Domain\Tenancy\Queries;

use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * For a clerk / officer / supervisor: the companies they work in, the invitations waiting for their
 * answer, their own open requests, and the companies they could ask to join.
 * Company names and types only: nothing about the people in those companies.
 */
class MyCompanyAccess
{
    public function overview(User $user, ?string $search = null): array
    {
        $rows = DB::table('user_company_access as uca')
            ->join('companies', 'companies.id', '=', 'uca.company_id')
            ->leftJoin('users as asker', 'asker.id', '=', 'uca.requested_by')
            ->where('uca.user_id', $user->id)
            ->get([
                'uca.company_id', 'uca.granted_status', 'uca.kind', 'uca.message', 'uca.granted_at',
                'companies.name', 'companies.type', 'companies.is_active', 'companies.suspended_at',
                DB::raw("TRIM(CONCAT(COALESCE(asker.first_name,''),' ',COALESCE(asker.last_name,''))) as asked_by"),
            ]);

        $company = fn ($r) => [
            'id' => (int) $r->company_id,
            'name' => $r->name,
            'type' => $r->type,
            'is_home' => (int) $r->company_id === (int) $user->company_id,
            'suspended' => $r->suspended_at !== null || ! $r->is_active,
            'message' => $r->message,
            'asked_by' => $r->asked_by ?: null,
            'at' => $r->granted_at ? Carbon::parse($r->granted_at)->toIso8601String() : null,
        ];

        $open = $rows->whereIn('granted_status', ['accepted', 'pending'])->pluck('company_id')->all();

        $askable = DB::table('companies')
            ->where('is_active', true)->whereNull('suspended_at')
            ->whereNotIn('id', $open ?: [0])
            ->when($search, fn ($q) => $q->where('name', 'like', '%'.addcslashes($search, '\\%_').'%'))
            ->orderBy('name')->limit(50)
            ->get(['id', 'name', 'type'])
            ->map(fn ($c) => ['id' => (int) $c->id, 'name' => $c->name, 'type' => $c->type])
            ->all();

        return [
            'companies' => $rows->where('granted_status', 'accepted')->map($company)->sortBy('name')->values()->all(),
            'invitations' => $rows->where('granted_status', 'pending')->where('kind', 'invite')->map($company)->values()->all(),
            'requests' => $rows->where('granted_status', 'pending')->where('kind', 'request')->map($company)->values()->all(),
            'can_ask' => $askable,
        ];
    }
}
