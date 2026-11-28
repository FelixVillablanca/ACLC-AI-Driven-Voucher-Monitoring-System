<?php

namespace App\Http\Requests\Vouchers;

use App\Domain\Vouchers\Cheques\ChequeRegister;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/** GET /api/v1/cheques?view=&search=&sort=&page=  (cheque register, 2026-11-29) */
class ListChequesRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // role clerk / officer / supervisor + company
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'view' => ['nullable', Rule::in(ChequeRegister::VIEWS)],
            'sort' => ['nullable', Rule::in(ChequeRegister::SORTS)],
            'search' => ['nullable', 'string', 'max:100'],
            'page' => ['nullable', 'integer', 'min:1'],
        ];
    }

    /** @return array{view: ?string, search: ?string, sort: ?string} */
    public function filters(): array
    {
        return ['view' => $this->validated('view'), 'search' => $this->validated('search'), 'sort' => $this->validated('sort')];
    }
}
