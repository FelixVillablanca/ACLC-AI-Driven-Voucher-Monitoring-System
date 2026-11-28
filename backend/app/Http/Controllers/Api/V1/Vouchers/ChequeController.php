<?php

namespace App\Http\Controllers\Api\V1\Vouchers;

use App\Domain\Vouchers\Cheques\ChequeRegister;
use App\Domain\Vouchers\Cheques\ManageCheques;
use App\Domain\Vouchers\Queries\ClerkVouchers;
use App\Http\Controllers\Controller;
use App\Http\Requests\Vouchers\ChequeStepRequest;
use App\Http\Requests\Vouchers\ListChequesRequest;
use App\Http\Requests\Vouchers\RecordChequeRequest;
use App\Http\Resources\Vouchers\ChequeResource;
use App\Models\Cheque;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * Cheque register (user decisions 2026-11-29). The company in X-Company-ID.
 *   GET  /cheques                          the register (clerk: own vouchers; officer / supervisor: the company, read-only)
 *   GET  /vouchers/{id}/cheques            every cheque of one of the clerk's vouchers, newest first
 *   POST /vouchers/{id}/cheques            record the cheque (approved cheque voucher, no live cheque yet)
 *   POST /cheques/{id}/release|clear|cancel  the next step (clerk only)
 * Another person's voucher or cheque = 404.
 */
class ChequeController extends Controller
{
    public function index(ListChequesRequest $request): AnonymousResourceCollection
    {
        $register = $this->register($request);
        $page = $register->list($request->filters())->paginate(20)->withQueryString();

        return ChequeResource::collection($page)->additional(['meta' => $register->summary()]);
    }

    public function forVoucher(Request $request, int $voucher): AnonymousResourceCollection
    {
        $v = $this->vouchers($request)->find($voucher);

        return ChequeResource::collection(
            Cheque::query()->where('voucher_id', $v->id)->with(['voucher:id,voucher_number,created_by', 'creator:id,first_name,last_name'])
                ->orderByDesc('id')->get()
        );
    }

    public function store(RecordChequeRequest $request, int $voucher, ManageCheques $cheques): JsonResponse
    {
        $cheque = $cheques->record($this->vouchers($request)->find($voucher), $request->user(), $request->validated(), $request->ip());

        return $this->one($request, $cheque->id)->response()->setStatusCode(201);
    }

    public function release(ChequeStepRequest $request, int $cheque, ManageCheques $cheques): ChequeResource
    {
        $cheques->release($this->mine($request, $cheque), $request->user(), $request->validated('received_by'), $request->ip());

        return $this->one($request, $cheque);
    }

    public function clear(ChequeStepRequest $request, int $cheque, ManageCheques $cheques): ChequeResource
    {
        $cheques->clear($this->mine($request, $cheque), $request->user(), $request->validated('cleared_on'), $request->ip());

        return $this->one($request, $cheque);
    }

    public function cancel(ChequeStepRequest $request, int $cheque, ManageCheques $cheques): ChequeResource
    {
        $cheques->cancel($this->mine($request, $cheque), $request->user(), $request->validated('reason'), $request->ip());

        return $this->one($request, $cheque);
    }

    private function register(Request $request): ChequeRegister
    {
        return new ChequeRegister($request->user(), $request->attributes->get('company'));
    }

    private function vouchers(Request $request): ClerkVouchers
    {
        return new ClerkVouchers($request->user(), $request->attributes->get('company'));
    }

    /** A cheque of one of the clerk's own vouchers, else 404. */
    private function mine(Request $request, int $id): Cheque
    {
        return $this->register($request)->base()->findOrFail($id);
    }

    private function one(Request $request, int $id): ChequeResource
    {
        return ChequeResource::make($this->register($request)->base()
            ->with(['voucher:id,voucher_number,created_by', 'creator:id,first_name,last_name'])->findOrFail($id));
    }
}
