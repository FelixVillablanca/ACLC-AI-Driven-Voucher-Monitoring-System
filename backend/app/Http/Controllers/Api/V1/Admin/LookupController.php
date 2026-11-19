<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\Company;
use Illuminate\Http\JsonResponse;

/**
 * LOOKUPS = small lists used to fill dropdowns and checkboxes in forms.
 *
 * GET /api/v1/admin/lookups/companies
 *   every company (active first, then inactive), each with its active departments.
 *   The Create user modal uses it for "Primary company", "Department" and "Company access".
 */
class LookupController extends Controller
{
    public function companies(): JsonResponse
    {
        $companies = Company::query()
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
}
