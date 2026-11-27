<?php

namespace App\Domain\Approvals\Queries;

use App\Models\Company;
use App\Models\User;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * "Reviewed by me" (code-first, 2026-11-26): every step-1 decision this officer made in this company,
 * newest first, with today's totals for the "Queue cleared" state (Framer Ssn7fclsz).
 */
class OfficerReviews
{
    public const ACTIONS = ['approved', 'returned', 'rejected'];

    public function __construct(private User $officer, private Company $company) {}

    public function query(?string $action): Builder
    {
        return DB::table('voucher_approvals as a')
            ->join('vouchers as v', 'v.id', '=', 'a.voucher_id')
            ->leftJoin('users as c', 'c.id', '=', 'v.created_by')
            ->where('a.approver_id', $this->officer->id)->where('v.company_id', $this->company->id)
            ->when($action, fn ($q) => $q->where('a.action', $action))
            ->orderByDesc('a.created_at')->orderByDesc('a.id')
            ->select([
                'a.id', 'a.action', 'a.remarks', 'a.needs_changes', 'a.reason', 'a.created_at',
                'v.id as voucher_id', 'v.voucher_number', 'v.payee_name', 'v.amount', 'v.status',
                'c.first_name as clerk_first', 'c.last_name as clerk_last',
            ]);
    }

    /** { approved, returned, rejected, total } today + when the last review happened. */
    public function today(): array
    {
        $rows = DB::table('voucher_approvals as a')->join('vouchers as v', 'v.id', '=', 'a.voucher_id')
            ->where('a.approver_id', $this->officer->id)->where('v.company_id', $this->company->id)
            ->where('a.created_at', '>=', now()->startOfDay())
            ->selectRaw('a.action, COUNT(*) as n')->groupBy('a.action')->pluck('n', 'action');

        $last = DB::table('voucher_approvals as a')->join('vouchers as v', 'v.id', '=', 'a.voucher_id')
            ->where('a.approver_id', $this->officer->id)->where('v.company_id', $this->company->id)->max('a.created_at');

        return [
            'approved' => (int) ($rows['approved'] ?? 0),
            'returned' => (int) ($rows['returned'] ?? 0),
            'rejected' => (int) ($rows['rejected'] ?? 0),
            'total' => (int) $rows->sum(),
            'last_reviewed_at' => $last ? Carbon::parse($last)->toIso8601String() : null,
        ];
    }
}
