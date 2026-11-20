<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;

/** The 6-digit code from the authenticator app, OR one backup (recovery) code. */
class TwoFactorCodeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // public: the half-signed-in session is checked in the controller
    }

    public function rules(): array
    {
        return [
            'code' => ['required_without:recovery_code', 'nullable', 'string', 'max:10'],
            'recovery_code' => ['required_without:code', 'nullable', 'string', 'max:20'],
        ];
    }

    public function messages(): array
    {
        return [
            'code.required_without' => 'Type the 6-digit code from your authenticator app.',
            'recovery_code.required_without' => 'Type one of your backup codes.',
        ];
    }
}
