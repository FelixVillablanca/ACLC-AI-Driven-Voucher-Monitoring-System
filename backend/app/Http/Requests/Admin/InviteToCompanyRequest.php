<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

/**
 * POST /api/v1/admin/company-access/invitations  { user_id, message? }
 * Invite a clerk / officer / supervisor of ANOTHER company to work in the Admin's company.
 * Who may be invited is checked in CrossCompanyAccess (with the row locked).
 */
class InviteToCompanyRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // role:admin middleware
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->message)) {
            $this->merge(['message' => trim($this->message) ?: null]);
        }
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'user_id' => ['required', 'integer'],
            'message' => ['nullable', 'string', 'max:500'],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return ['user_id.required' => 'Choose who to invite.', 'message.max' => 'Keep the message under 500 characters.'];
    }
}
