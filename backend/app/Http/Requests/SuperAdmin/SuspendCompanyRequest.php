<?php

namespace App\Http\Requests\SuperAdmin;

use Illuminate\Foundation\Http\FormRequest;

/**
 * POST /api/v1/superadmin/companies/{company}/suspend   (Framer C6 eGUijf8Wd)
 *   { reason: "Unpaid subscription…", notify_admin: true }
 * The reason is required: it's saved in the audit log and shown to the company's Admin.
 * ("Type APEX to confirm" is a check in the dialog, so a slip of the mouse can't suspend a company.)
 */
class SuspendCompanyRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // role:super_admin middleware
    }

    public function rules(): array
    {
        return [
            'reason' => ['required', 'string', 'min:5', 'max:500'],
            'notify_admin' => ['sometimes', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'reason.required' => 'Write why you’re suspending this company.',
            'reason.min' => 'Write a little more, so the Admin understands why.',
        ];
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->reason)) {
            $this->merge(['reason' => trim($this->reason)]);
        }
    }
}
