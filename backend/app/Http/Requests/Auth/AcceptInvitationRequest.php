<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;

/** The "Set your password" page: the link's email + token, and the new password typed twice. */
class AcceptInvitationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // public: the token itself is the permission
    }

    /** @return array<string, array<int, string>> */
    public function rules(): array
    {
        return [
            'email' => ['required', 'string', 'email'],
            'token' => ['required', 'string', 'max:255'],
            // Same rule as everywhere else: 12+ characters with letters AND numbers
            'password' => ['required', 'string', 'min:12', 'max:64', 'regex:/[A-Za-z]/', 'regex:/[0-9]/', 'confirmed'],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'password.required' => 'Choose a password.',
            'password.min' => 'Use at least 12 characters.',
            'password.regex' => 'Use both letters and numbers.',
            'password.confirmed' => 'The two passwords don’t match.',
        ];
    }
}
