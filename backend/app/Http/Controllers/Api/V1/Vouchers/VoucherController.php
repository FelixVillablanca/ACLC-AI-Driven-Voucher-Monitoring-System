<?php

namespace App\Http\Controllers\Api\V1\Vouchers;

use App\Domain\Vouchers\Actions\DeleteVoucherDrafts;
use App\Domain\Vouchers\Actions\SaveVoucherDraft;
use App\Domain\Vouchers\Actions\TransitionVoucher;
use App\Domain\Vouchers\Queries\ClerkVouchers;
use App\Http\Controllers\Controller;
use App\Http\Requests\Vouchers\DeleteDraftsRequest;
use App\Http\Requests\Vouchers\ListVouchersRequest;
use App\Http\Requests\Vouchers\SaveVoucherRequest;
use App\Http\Resources\Vouchers\VoucherResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
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
 *   DELETE /vouchers/{id}                  delete a never-submitted draft for good (204)
 *   POST   /vouchers/drafts/delete         delete several drafts at once, all or nothing
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
            // saved payees (2026-11-26): picking one fills type, payment and bank details
            'payees' => DB::table('payees')->where('company_id', $company->id)->where('is_active', true)->orderBy('name')->limit(2000)
                ->get(['id', 'name', 'payee_type_id', 'tin', 'default_payment_method', 'bank_name', 'bank_account_number', 'bank_account_name']),
            'departments' => DB::table('departments')->where('company_id', $company->id)->where('is_active', true)->orderBy('name')->get(['id', 'name', 'code']),
            'payment_methods' => SaveVoucherRequest::PAYMENT_METHODS,
            'priorities' => SaveVoucherRequest::PRIORITIES,
            'my_department_id' => $request->user()->department_id,
        ]]);
    }

    public function index(ListVouchersRequest $request): AnonymousResourceCollection
    {
        $vouchers = $this->mine($request);

        [$view, $search] = [$request->validated('filter.view'), $request->validated('search')];
        $page = $vouchers->list($view, $search, $request->validated('sort'))->paginate(20)->withQueryString();

        return VoucherResource::collection($page)->additional(['meta' => [
            'counts' => $vouchers->counts(),
            'total_amount' => $vouchers->totalAmount($view, $search),
        ]]);
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

    public function destroy(DeleteDraftsRequest $request, int $voucher, DeleteVoucherDrafts $delete): Response
    {
        $delete->delete([$voucher], $this->mine($request), $request->user(), $request->validated('updated_at'), $request->ip());

        return response()->noContent();
    }

    public function destroyMany(DeleteDraftsRequest $request, DeleteVoucherDrafts $delete): JsonResponse
    {
        $count = $delete->delete($request->validated('ids'), $this->mine($request), $request->user(), null, $request->ip());

        return response()->json(['data' => ['deleted' => $count]]);
    }

    private function mine(Request $request): ClerkVouchers
    {
        return new ClerkVouchers($request->user(), $request->attributes->get('company'));
    }
}
