<?php

namespace App\Http\Controllers\Api\V1\Payees;

use App\Domain\Audit\AuditTrail;
use App\Domain\Catalog\Payees\PayeeDirectory;
use App\Domain\Catalog\Payees\PayeeMatcher;
use App\Domain\Catalog\Payees\SavePayee;
use App\Http\Controllers\Controller;
use App\Http\Requests\Payees\ListPayeesRequest;
use App\Http\Requests\Payees\SavePayeeRequest;
use App\Http\Resources\Payees\PayeeResource;
use App\Support\Exports\TabularExport;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Carbon;

/**
 * Payees (Framer jbj8yIDz9 list, GZb92vr4M side panel, UKm7GrwEZ Add payee), 2026-11-26.
 * The company in X-Company-ID; clerks only (role:accounting_clerk + company).
 *   GET   /payees?filter[status]=&filter[type]=&search=&sort=&page=   list + meta.counts (type chips)
 *   GET   /payees/similar?name=&tin=&ignore=   "already on the list?" while typing in Add payee
 *   GET   /payees/export?format=csv|xlsx&…     the list as shown (audited)
 *   POST  /payees                              add (201)
 *   GET   /payees/{id}                         side panel
 *   PATCH /payees/{id}                         edit (updated_at → 409 PAYEE_CHANGED)
 *   POST  /payees/{id}/deactivate|reactivate
 */
class PayeeController extends Controller
{
    public function index(ListPayeesRequest $request): AnonymousResourceCollection
    {
        $dir = $this->directory($request);
        $status = $request->validated('filter.status');
        $page = $dir->list($status, $request->validated('filter.type'), $request->validated('search'), $request->validated('sort'))
            ->paginate(20)->withQueryString();

        return PayeeResource::collection($page)->additional(['meta' => ['counts' => $dir->counts($status)]]);
    }

    public function similar(Request $request, PayeeMatcher $matcher): JsonResponse
    {
        $data = $request->validate([
            'name' => ['nullable', 'string', 'max:255'],
            'tin' => ['nullable', 'string', 'max:20'],
            'ignore' => ['nullable', 'integer'],
        ]);
        $matches = $matcher->find($request->attributes->get('company')->id, $data['name'] ?? null, $data['tin'] ?? null, $data['ignore'] ?? null);

        return response()->json(['data' => $matches->map(fn ($m) => [
            'id' => $m['payee']->id,
            'name' => $m['payee']->name,
            'tin' => $m['payee']->tin,
            'type' => $m['payee']->type?->name,
            'is_active' => (bool) $m['payee']->is_active,
            'reason' => $m['reason'],
        ])->all()]);
    }

    public function export(ListPayeesRequest $request, TabularExport $export): Response
    {
        $rows = $this->directory($request)
            ->list($request->validated('filter.status'), $request->validated('filter.type'), $request->validated('search'), $request->validated('sort'))
            ->limit(5000)->get()
            ->map(fn ($p) => [
                $p->name, $p->type?->name ?? '', $p->tin ?? '', self::METHODS[$p->default_payment_method] ?? '',
                $p->bank_name ?? '', $p->bank_account_number ?? '', $p->bank_account_name ?? '', $p->address ?? '', $p->email ?? '',
                $p->is_active ? 'Active' : 'Inactive', (int) $p->vouchers_count, (float) $p->approved_ytd,
                $p->last_used_at ? Carbon::parse($p->last_used_at)->format('Y-m-d') : '',
            ])->all();
        $headers = ['Payee', 'Type', 'TIN', 'Default payment', 'Bank', 'Account no.', 'Account name', 'Address', 'Email', 'Status',
            'My vouchers', 'My approved this year (PHP)', 'Last used'];
        $format = $request->validated('format', 'csv');

        AuditTrail::record([
            'user_id' => $request->user()->id,
            'company_id' => $request->attributes->get('company')->id,
            'action' => 'payees_exported',
            'table_name' => 'payees',
            'new_values' => ['format' => $format, 'count' => count($rows)],
            'ip_address' => $request->ip(),
        ]);

        return response($format === 'xlsx' ? $export->xlsx('Payees', $headers, $rows) : $export->csv($headers, $rows), 200, [
            'Content-Type' => $format === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="payees-'.now()->format('Y-m-d').'.'.$format.'"',
            'Cache-Control' => 'no-store', // bank account numbers: no copies in caches
        ]);
    }

    public function store(SavePayeeRequest $request, SavePayee $save): JsonResponse
    {
        $payee = $save->create($request->validated(), $request->user(), $request->attributes->get('company'), $request->ip());

        return $this->detail($request, $payee->id)->response()->setStatusCode(201);
    }

    public function show(Request $request, int $payee): PayeeResource
    {
        return $this->detail($request, $payee);
    }

    public function update(SavePayeeRequest $request, int $payee, SavePayee $save): PayeeResource
    {
        $save->update($this->directory($request)->base()->findOrFail($payee), $request->validated(), $request->validated('updated_at'), $request->user(), $request->ip());

        return $this->detail($request, $payee);
    }

    public function deactivate(Request $request, int $payee, SavePayee $save): PayeeResource
    {
        $save->setActive($this->directory($request)->base()->findOrFail($payee), false, $request->user(), $request->ip());

        return $this->detail($request, $payee);
    }

    public function reactivate(Request $request, int $payee, SavePayee $save): PayeeResource
    {
        $save->setActive($this->directory($request)->base()->findOrFail($payee), true, $request->user(), $request->ip());

        return $this->detail($request, $payee);
    }

    private const METHODS = ['cash' => 'Cash', 'bank' => 'Bank transfer', 'cheque' => 'Cheque'];

    private function detail(Request $request, int $id): PayeeResource
    {
        $dir = $this->directory($request);
        $payee = $dir->find($id);

        return PayeeResource::make($payee)->withDetails($dir->details($payee));
    }

    private function directory(Request $request): PayeeDirectory
    {
        return new PayeeDirectory($request->user(), $request->attributes->get('company'));
    }
}
