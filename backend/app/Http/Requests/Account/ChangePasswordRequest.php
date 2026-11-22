<?php

namespace App\Http\Requests\Account;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

/**
 * Change password: the current one (proves it's really you, not someone at an unlocked computer)
 * and the new one typed twice. Same strength rule as the "Set your password" page.
 */
class ChangePasswordRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, array<int, string>> */
    public function rules(): array
    {
        return [
            'current_password' => ['required', 'string', 'current_password:web'],
            'password' => ['required', 'string', 'min:12', 'max:64', 'regex:/[A-Za-z]/', 'regex:/[0-9]/', 'confirmed'],
        ];
    }

    public function after(): array
    {
        return [
            function (Validator $validator) {
                if (! $validator->errors()->has('password') && $this->input('password') === $this->input('current_password')) {
                    $validator->errors()->add('password', 'Choose a password you are not using now.');
                }
                // Don't allow the password to contain the person's own name or email name (easy to guess)
                $password = strtolower((string) $this->input('password'));
                $user = $this->user();
                foreach ([$user->first_name, $user->last_name, strstr((string) $user->email, '@', true)] as $part) {
                    $part = strtolower(trim((string) $part));
                    if (strlen($part) >= 4 && str_contains($password, $part)) {
                        $validator->errors()->add('password', 'Don’t use your name or email in your password.');
                        break;
                    }
                }
            },
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'current_password.required' => 'Type your current password.',
            'current_password.current_password' => 'That is not your current password.',
            'password.required' => 'Choose a new password.',
            'password.min' => 'Use at least 12 characters.',
            'password.max' => 'Use at most 64 characters.',
            'password.regex' => 'Use both letters and numbers.',
            'password.confirmed' => 'The two new passwords don’t match.',
        ];
    }
}
