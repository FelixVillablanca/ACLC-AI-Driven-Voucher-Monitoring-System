<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Domain\Tenancy\Queries\CompanyDirectory;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreDepartmentRequest;
use App\Models\Company;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * LOOKUPS = small lists used to fill dropdowns and checkboxes in forms.
 *
 * GET /api/v1/admin/lookups/companies
 *   the Admin's OWN company (one per Admin since 2026-11-20), with its active departments.
 *   The Create user modal uses it for "Primary company", "Department" and "Company access".
 */
class LookupController extends Controller
{
    public function companies(Request $request): JsonResponse
    {
        $companies = Company::query()
            ->whereKey($request->user()->company_id ?? 0)
            ->with(['departments' => fn ($q) => $q->where(fn ($q) => $q->where('is_active', true)->orWhereNull('is_active'))->orderBy('name')])
            ->orderByDesc('is_active')
            ->orderBy('name')
            ->get();

        return response()->json([
            'data' => $companies->map(fn (Company $c) => [
                'id' => $c->id,
                'name' => $c->name,
                'is_active' => (bool) $c->is_active,
                'departments' => $c->departments->map(fn ($d) => ['id' => $d->id, 'name' => $d->name, 'code' => $d->code])->values(),
            ])->values(),
        ]);
    }

    /**
     * GET /api/v1/admin/lookups/people
     *   active clerks / officers / supervisors of the Admin's company, A–Z (e.g. "Department head").
     */
    public function people(Request $request): JsonResponse
    {
        $people = CompanyDirectory::usersOf((int) ($request->user()->company_id ?? 0))
            ->whereIn('role', StoreDepartmentRequest::OPERATIONAL_ROLES)
            ->where('is_active', true)
            ->orderBy('first_name')->orderBy('last_name')
            ->limit(500)
            ->get(['id', 'first_name', 'last_name', 'role']);

        return response()->json([
            'data' => $people->map(fn ($u) => ['id' => $u->id, 'full_name' => $u->full_name, 'role' => $u->role])->values(),
        ]);
    }
}
