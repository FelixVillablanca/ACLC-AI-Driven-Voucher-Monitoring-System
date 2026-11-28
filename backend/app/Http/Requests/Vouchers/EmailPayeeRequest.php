<?php

namespace App\Http\Requests\Vouchers;

use Illuminate\Foundation\Http\FormRequest;

/**
 * POST /api/v1/vouchers/{voucher}/email-payee  { note? }  ("Email the payee" after the final approval, 2026-11-28)
 */
class EmailPayeeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // role:accounting_clerk + company; only the clerk's own vouchers are found
    }

    protected function prepareForValidation(): void
    {
        $note = $this->input('note');
        $this->merge(['note' => is_string($note) ? (trim($note) ?: null) : $note]);
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return ['note' => ['nullable', 'string', 'max:500']];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return ['note.max' => 'Keep the note under 500 characters.'];
    }
}
