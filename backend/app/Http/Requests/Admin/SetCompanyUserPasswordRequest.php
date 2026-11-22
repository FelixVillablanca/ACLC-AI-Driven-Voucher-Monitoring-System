<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

/** POST /api/v1/admin/users/{user}/password  { password } (generated in the form, like Create user) */
class SetCompanyUserPasswordRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // role:admin middleware
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return ['password' => ['required', 'string', 'min:12', 'max:64', 'regex:/[A-Za-z]/', 'regex:/[0-9]/']];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'password.required' => 'Generate a password.',
            'password.min' => 'The password must be at least 12 characters.',
            'password.regex' => 'The password must contain both letters and numbers.',
        ];
    }
}
