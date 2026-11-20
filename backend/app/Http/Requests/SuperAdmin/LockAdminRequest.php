<?php

namespace App\Http\Requests\SuperAdmin;

/**
 * Lock account. Locking works like deactivating, which the spec (§4) calls a SENSITIVE action,
 * so the Super Admin types their own password again ("current_password" checks it).
 */
class LockAdminRequest extends AdminAccountActionRequest
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
