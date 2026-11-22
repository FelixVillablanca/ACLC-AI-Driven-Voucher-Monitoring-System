<?php

namespace App\Http\Requests\Account;

use Illuminate\Foundation\Http\FormRequest;

/** Turn off two-step / new backup codes: type your password again first. */
class ConfirmPasswordRequest extends FormRequest
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
