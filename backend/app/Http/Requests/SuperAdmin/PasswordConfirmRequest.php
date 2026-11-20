<?php

namespace App\Http\Requests\SuperAdmin;

use Illuminate\Foundation\Http\FormRequest;

/** Sensitive actions (Make Super Admin): the Super Admin types their own password again. */
class PasswordConfirmRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return ['password' => ['required', 'string', 'current_password:web']];
    }

    public function messages(): array
    {
        return [
            'password.required' => 'Type your password to confirm.',
            'password.current_password' => 'That password is not correct.',
        ];
    }
}
