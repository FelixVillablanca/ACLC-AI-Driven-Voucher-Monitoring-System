<?php

namespace App\Http\Requests\SuperAdmin;

use App\Domain\Identity\Actions\RequireTwoFactor;
use Illuminate\Foundation\Http\FormRequest;

/**
 * The "2 selected" bar (A6): POST /api/v1/superadmin/admins/bulk
 *   { action: "password_reset" | "require_two_factor" | "deactivate", ids: [1, 2],
 *     password (deactivate), setup_days (require_two_factor), sign_out (password_reset) }
 */
class BulkAdminActionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'action' => ['required', 'in:password_reset,require_two_factor,deactivate'],
            'ids' => ['required', 'array', 'min:1', 'max:100'],
            'ids.*' => ['integer', 'distinct'],
            'password' => ['required_if:action,deactivate', 'nullable', 'string', 'current_password:web'],
            'setup_days' => ['required_if:action,require_two_factor', 'nullable', 'integer', 'in:'.implode(',', RequireTwoFactor::SETUP_DAYS)],
            'email_steps' => ['sometimes', 'boolean'],
            'sign_out' => ['sometimes', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'password.required_if' => 'Type your password to confirm.',
            'password.current_password' => 'That password is not correct.',
            'ids.required' => 'Select at least one account.',
        ];
    }
}
