<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;

/**
 * FORM REQUEST = the "bouncer" for one form. It checks the data BEFORE the
 * controller runs. If anything is wrong, Laravel answers 422 with a list of
 * field errors, and the controller never runs.
 */
class LoginRequest extends FormRequest
{
    /** Anyone may TRY to log in (guests included). */
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, array<int, string>> */
    public function rules(): array
    {
        return [
            'email' => ['required', 'string', 'email', 'max:255'],
            'password' => ['required', 'string', 'max:255'],
            'remember' => ['sometimes', 'boolean'],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'email.required' => 'Enter your work email.',
            'email.email' => 'Enter a valid email address.',
            'password.required' => 'Enter your password.',
        ];
    }
}
