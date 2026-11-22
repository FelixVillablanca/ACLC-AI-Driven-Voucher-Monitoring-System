<?php

namespace App\Http\Controllers\Api\V1\SuperAdmin;

use App\Domain\Security\Support\OwnerActivity;
use App\Domain\Tenancy\Actions\CreateCompany;
use App\Domain\Tenancy\Actions\ReactivateCompany;
use App\Domain\Tenancy\Actions\SuspendCompany;
use App\Domain\Tenancy\Queries\CompanyDirectory;
use App\Domain\Tenancy\Queries\CompanyProfile;
use App\Domain\Tenancy\Support\CompanyExport;
use App\Http\Controllers\Controller;
use App\Http\Requests\SuperAdmin\CompanyPanelPageRequest;
use App\Http\Requests\SuperAdmin\ExportCompaniesRequest;
use App\Http\Requests\SuperAdmin\ListCompaniesRequest;
use App\Http\Requests\SuperAdmin\ReactivateCompanyRequest;
use App\Http\Requests\SuperAdmin\StoreCompanyRequest;
use App\Http\Requests\SuperAdmin\SuspendCompanyRequest;
use App\Http\Resources\CompanyCardResource;
use App\Http\Resources\CompanyDetailResource;
use App\Http\Resources\CompanyMemberResource;
use App\Models\Company;
use App\Models\Department;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Carbon;

/**
 * The Super Admin's Companies tab (Framer vnNFYExpX) + C1–C8: list, search, sort, views, export,
 * the company side panel, add (2026-11-22), suspend and reactivate. Counts only: the Super Admin never sees vouchers or money.
 */
class CompanyController extends Controller
{
    public function __construct(private CompanyDirectory $directory) {}

    /**
     * GET /api/v1/superadmin/companies
     * meta.views = the numbers on the view tabs (they follow the search); meta.summary = the 4 cards.
     */
    public function index(ListCompaniesRequest $request): AnonymousResourceCollection
    {
        $search = $request->validated('search');

        $companies = $this->directory->sort(
            $this->directory->withCardData(
                $this->directory->view($this->directory->base($search), $request->validated('filter.view')),
            ),
            $request->validated('sort', 'name'),
            $request->boolean('suspended_first'),
        )->paginate((int) $request->validated('per_page', 24))->withQueryString();

        return CompanyCardResource::collection($companies)->additional(['meta' => [
            'views' => $this->directory->viewCounts($search),
            'summary' => $this->directory->summary(),
        ]]);
    }

    /**
     * GET /api/v1/superadmin/companies/export  (C1 "Export companies")
     * Same order as the screen. The export itself is written to the audit log.
     */
    public function export(ExportCompaniesRequest $request, CompanyExport $export): Response
    {
        $which = $request->validated('companies');
        $query = $this->directory->base($which === 'search' ? $request->validated('search') : null);
        if (in_array($which, ['active', 'suspended'], true)) {
            $this->directory->view($query, $which);
        }
        $companies = $this->directory->sort(
            $this->directory->withCardData($query),
            $request->validated('sort', 'name'),
            $request->boolean('suspended_first'),
        )->get();

        // keep the dialog's column order, whatever order the browser sent them in
        $columns = array_values(array_intersect(array_keys(CompanyExport::COLUMNS), $request->validated('columns')));
        [$headers, $rows] = $export->table($companies, $columns);
        $format = $request->validated('format');

        OwnerActivity::audit($request->user(), 'companies_exported', 'companies', null, null,
            ['format' => $format, 'count' => count($rows), 'columns' => $columns, 'companies' => $which], $request->ip());

        return response($export->file($format, $headers, $rows, $request->user()), 200, [
            'Content-Type' => CompanyExport::contentType($format),
            'Content-Disposition' => 'attachment; filename="company-list-'.now()->format('Y-m-d').'.'.$format.'"',
            'Cache-Control' => 'no-store', // names and counts: don't keep copies in browser/proxy caches
        ]);
    }

    /** GET /api/v1/superadmin/companies/{company}  (C8 side panel: header + Overview tab) */
    public function show(Company $company, CompanyProfile $profile): CompanyDetailResource
    {
        $row = $this->directory->withCardData(Company::query()->whereKey($company->id))->firstOrFail();

        return CompanyDetailResource::make($row)->withProfile($profile->overview($company));
    }

    /** GET /api/v1/superadmin/companies/{company}/departments  (C8 Departments tab, biggest first) */
    public function departments(Company $company, CompanyProfile $profile): JsonResponse
    {
        return response()->json(['data' => $profile->departments($company)->map(fn (Department $d) => [
            'id' => $d->id,
            'name' => $d->name,
            'code' => $d->code,
            'is_active' => $d->is_active,
            'users_count' => (int) $d->users_count,
            'head' => $d->head?->full_name,
        ])->values()]);
    }

    /** GET /api/v1/superadmin/companies/{company}/users?page=  (C8 Users tab, A–Z, 20 a page) */
    public function users(CompanyPanelPageRequest $request, Company $company, CompanyProfile $profile): AnonymousResourceCollection
    {
        return CompanyMemberResource::collection($profile->users($company));
    }

    /**
     * GET /api/v1/superadmin/companies/{company}/history?page=  (C8 History tab, newest first)
     * meta.created_at lets the screen end the timeline with "Added to the platform".
     */
    public function history(CompanyPanelPageRequest $request, Company $company, CompanyProfile $profile): JsonResponse
    {
        $page = $profile->history($company);

        return response()->json([
            'data' => collect($page->items())->map(fn ($row) => [
                'id' => $row->id,
                'action' => $row->action,
                'at' => $row->created_at ? Carbon::parse($row->created_at)->toIso8601String() : null,
                'by' => $row->user_id ? ['id' => $row->user_id, 'full_name' => $row->user_name ?: 'A removed account'] : null,
                'old' => json_decode((string) $row->old_values, true),
                'new' => json_decode((string) $row->new_values, true),
            ]),
            'meta' => [
                'current_page' => $page->currentPage(),
                'last_page' => $page->lastPage(),
                'total' => $page->total(),
                'created_at' => $company->created_at?->toIso8601String(),
            ],
        ]);
    }

    /** POST /api/v1/superadmin/companies -> 201 with the new company's card (it has no Admin yet) */
    public function store(StoreCompanyRequest $request, CreateCompany $create): JsonResponse
    {
        $company = $create->handle($request->validated(), $request->user(), $request->ip());

        return $this->card($company)->response()->setStatusCode(201);
    }

    /** POST /api/v1/superadmin/companies/{company}/suspend  { reason, notify_admin } */
    public function suspend(SuspendCompanyRequest $request, Company $company, SuspendCompany $suspend): CompanyCardResource
    {
        $result = $suspend->handle(
            $company,
            $request->user(),
            $request->validated('reason'),
            $request->boolean('notify_admin', true),
            $request->ip(),
        );

        return $this->card($result['company'])->additional(['meta' => [
            'signed_out' => $result['signed_out'],
            'admins_notified' => $result['admins_notified'],
        ]]);
    }

    /** POST /api/v1/superadmin/companies/{company}/reactivate  { note?, notify_admin } */
    public function reactivate(ReactivateCompanyRequest $request, Company $company, ReactivateCompany $reactivate): CompanyCardResource
    {
        $result = $reactivate->handle(
            $company,
            $request->user(),
            $request->validated('note'),
            $request->boolean('notify_admin', true),
            $request->ip(),
        );

        return $this->card($result['company'])->additional(['meta' => [
            'admins_notified' => $result['admins_notified'],
        ]]);
    }

    /** The same card the list shows, with fresh counts. */
    private function card(Company $company): CompanyCardResource
    {
        return CompanyCardResource::make(
            $this->directory->withCardData(Company::query()->whereKey($company->id))->firstOrFail(),
        );
    }
}
