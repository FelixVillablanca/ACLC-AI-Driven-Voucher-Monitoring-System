<?php

namespace App\Http\Requests\SuperAdmin;

/**
 * Deactivate account. The spec (§4) calls deactivating SENSITIVE, so the Super Admin types
 * their own password again ("current_password" checks it).
 */
class DeactivateAccountRequest extends AdminAccountActionRequest
{
    public function rules(): array
    {
        return [
            ...parent::rules(),
            'password' => ['required', 'string', 'current_password:web'],
        ];
    }

    public function messages(): array
    {
        return [
            'password.required' => 'Type your password to confirm.',
            'password.current_password' => 'That password is not correct.',
        ];
    }
}
