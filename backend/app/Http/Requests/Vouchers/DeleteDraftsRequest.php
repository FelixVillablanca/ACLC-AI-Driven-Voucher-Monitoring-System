<?php

namespace App\Http\Requests\Vouchers;

use App\Domain\Vouchers\Actions\DeleteVoucherDrafts;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Deleting drafts.
 *   DELETE /vouchers/{id}         { updated_at? }  one draft; updated_at = the version the screen showed
 *   POST   /vouchers/drafts/delete { ids: [..] }   the drafts ticked in Select mode (1–50)
 */
class DeleteDraftsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        if ($this->routeIs('*vouchers.drafts.delete')) {
            return [
                'ids' => ['required', 'array', 'min:1', 'max:'.DeleteVoucherDrafts::MAX],
                'ids.*' => ['required', 'integer', 'min:1', 'distinct'],
            ];
        }

        return ['updated_at' => ['nullable', 'string', 'max:40']];
    }

    public function messages(): array
    {
        return [
            'ids.required' => 'Choose at least one draft.',
            'ids.max' => 'Delete at most '.DeleteVoucherDrafts::MAX.' drafts at a time.',
        ];
    }
}
