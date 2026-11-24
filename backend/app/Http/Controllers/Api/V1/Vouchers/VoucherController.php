<?php

namespace App\Http\Controllers\Api\V1\Vouchers;

use App\Domain\Vouchers\Actions\SaveVoucherDraft;
use App\Domain\Vouchers\Actions\TransitionVoucher;
use App\Domain\Vouchers\Queries\ClerkVouchers;
use App\Http\Controllers\Controller;
use App\Http\Requests\Vouchers\ListVouchersRequest;
use App\Http\Requests\Vouchers\SaveVoucherRequest;
use App\Http\Resources\Vouchers\VoucherResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;

/**
 * A clerk's vouchers (Phase 3, 2026-11-22). Always the clerk's OWN vouchers in the company in X-Company-ID.
 *   GET    /vouchers/form-options          what the form's lists offer (this company only)
 *   GET    /vouchers?filter[view]=&search=&sort=&page=     My vouchers (+ meta.counts for the tabs)
 *   POST   /vouchers                       new draft (201)
 *   GET    /vouchers/{id}                  one voucher with lines + reviewers' history
 *   PATCH  /vouchers/{id}                  save a draft / returned voucher
 *   POST   /vouchers/{id}/submit           → with the Accounting Officer
 *   POST   /vouchers/{id}/cancel           → cancelled
 */
class VoucherController extends Controller
{
    public function formOptions(Request $request): JsonResponse
    {
        $company = $request->attributes->get('company');
        $named = fn (string $table) => DB::table($table)->where('company_id', $company->id)->orderBy('name')->get(['id', 'name']);

        return response()->json(['data' => [
            'categories' => DB::table('voucher_categories')->where('is_active', true)
                ->where(fn ($q) => $q->where('company_id', $company->id)->orWhereNull('company_id'))
                ->orderBy('name')->get(['id', 'name', 'code', 'description']),
            'voucher_types' => $named('voucher_types'),
            'payee_types' => $named('payee_types'),
            'departments' => DB::table('departments')->where('company_id', $company->id)->where('is_active', true)->orderBy('name')->get(['id', 'name', 'code']),
            'payment_methods' => SaveVoucherRequest::PAYMENT_METHODS,
            'priorities' => SaveVoucherRequest::PRIORITIES,
            'my_department_id' => $request->user()->department_id,
        ]]);
    }

    public function index(ListVouchersRequest $request): AnonymousResourceCollection
    {
        $vouchers = $this->mine($request);

        $page = $vouchers->list($request->validated('filter.view'), $request->validated('search'), $request->validated('sort'))
            ->paginate(20)->withQueryString();

        return VoucherResource::collection($page)->additional(['meta' => ['counts' => $vouchers->counts()]]);
    }

    public function store(SaveVoucherRequest $request, SaveVoucherDraft $save): JsonResponse
    {
        $voucher = $save->create($request->validated(), $request->user(), $request->attributes->get('company'), $request->ip());

        return VoucherResource::make($this->mine($request)->find($voucher->id))->detailed()->response()->setStatusCode(201);
    }

    public function show(Request $request, int $voucher): VoucherResource
    {
        return VoucherResource::make($this->mine($request)->find($voucher))->detailed();
    }

    public function update(SaveVoucherRequest $request, int $voucher, SaveVoucherDraft $save): VoucherResource
    {
        $mine = $this->mine($request);
        $save->update($mine->find($voucher), $request->validated(), $request->validated('updated_at'), $request->user(), $request->ip());

        return VoucherResource::make($mine->find($voucher))->detailed();
    }

    public function submit(Request $request, int $voucher, TransitionVoucher $transition): VoucherResource
    {
        $mine = $this->mine($request);
        $transition->submit($mine->find($voucher), $request->user(), $request->attributes->get('company'), $request->ip());

        return VoucherResource::make($mine->find($voucher))->detailed();
    }

    public function cancel(Request $request, int $voucher, TransitionVoucher $transition): VoucherResource
    {
        $mine = $this->mine($request);
        $transition->cancel($mine->find($voucher), $request->user(), $request->ip());

        return VoucherResource::make($mine->find($voucher))->detailed();
    }

    private function mine(Request $request): ClerkVouchers
    {
        return new ClerkVouchers($request->user(), $request->attributes->get('company'));
    }
}
