<?php

namespace App\Http\Requests\SuperAdmin;

use Illuminate\Foundation\Http\FormRequest;

/**
 * POST /api/v1/superadmin/companies/{company}/reactivate   (Framer C7 B3zqVOXN4)
 *   { note: "Contract renewed on Nov 17" (optional), notify_admin: true }
 */
class ReactivateCompanyRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // role:super_admin middleware
    }

    public function rules(): array
    {
        return [
            'note' => ['sometimes', 'nullable', 'string', 'max:500'],
            'notify_admin' => ['sometimes', 'boolean'],
        ];
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->note)) {
            $this->merge(['note' => trim($this->note) === '' ? null : trim($this->note)]);
        }
    }
}
