<?php

namespace App\Http\Requests\Account;

use App\Domain\Identity\Account\UpdateOwnProfile;
use App\Domain\Identity\Support\RoleEmailDomains;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Validator;

/**
 * My profile → Save. Send only the fields being changed, plus `was` (what the screen showed):
 *   { first_name, last_name, personal_email, was: { first_name: "John", … }, current_password }
 * current_password is needed only when the personal email changes (reset links go there).
 */
class UpdateProfileRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // it's always your own account (the route has no id)
    }

    protected function prepareForValidation(): void
    {
        $clean = [];
        foreach (['first_name', 'last_name'] as $field) {
            if ($this->has($field)) {
                $clean[$field] = trim((string) $this->input($field));
            }
        }
        if ($this->has('personal_email')) {
            $clean['personal_email'] = strtolower(trim((string) $this->input('personal_email')));
        }
        $this->merge($clean);
    }

    /** @return array<string, array<int, mixed>> */
    public function rules(): array
    {
        // Admins and Super Admins must keep a personal email: their reset links go there
        $personalRequired = in_array($this->user()->role, ['admin', 'super_admin'], true) ? 'required' : 'nullable';

        return [
            'first_name' => ['sometimes', 'required', 'string', 'max:100', "regex:/^[\pL\pM' .-]+$/u"],
            'last_name' => ['sometimes', 'required', 'string', 'max:100', "regex:/^[\pL\pM' .-]+$/u"],
            'personal_email' => ['sometimes', $personalRequired, 'string', 'max:255', 'email:rfc'],
            'was' => ['sometimes', 'array'],
            'was.*' => ['nullable', 'string', 'max:255'],
            'current_password' => ['nullable', 'string'],
        ];
    }

    public function after(): array
    {
        return [
            function (Validator $validator) {
                if ($validator->errors()->isNotEmpty()) {
                    return;
                }
                if ($this->changes() === []) {
                    $validator->errors()->add('first_name', 'Change something first.');

                    return;
                }

                $personal = $this->input('personal_email');
                if ($personal === null || $personal === (string) $this->user()->personal_email) {
                    return;
                }
                $domain = strtolower(substr((string) strrchr((string) $personal, '@'), 1));
                if ($personal !== '' && in_array($domain, array_map('strtolower', RoleEmailDomains::DOMAINS), true)) {
                    $validator->errors()->add('personal_email', 'Use your own inbox (e.g. Gmail), not a sign-in address of this system.');
                }
                if (! $this->filled('current_password')) {
                    $validator->errors()->add('current_password', 'Type your password to change your personal email.');
                } elseif (! Hash::check((string) $this->input('current_password'), $this->user()->password)) {
                    $validator->errors()->add('current_password', 'That password is not correct.');
                }
            },
        ];
    }

    /** @return array<string, string> only the profile fields that were sent */
    public function changes(): array
    {
        // read from the (cleaned) input, not validated(): after() runs inside validation itself
        return array_map(fn ($v) => (string) $v, $this->only(UpdateOwnProfile::FIELDS));
    }

    /** @return array<string, ?string> */
    public function was(): array
    {
        return array_intersect_key((array) $this->input('was', []), array_flip(UpdateOwnProfile::FIELDS));
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'first_name.required' => 'Enter your first name.',
            'last_name.required' => 'Enter your last name.',
            'first_name.regex' => 'Use letters, spaces, apostrophes, dots and hyphens only.',
            'last_name.regex' => 'Use letters, spaces, apostrophes, dots and hyphens only.',
            'personal_email.required' => 'Enter your personal email. Password-reset links are sent there.',
            'personal_email.email' => 'Enter a valid email address, like name@gmail.com.',
        ];
    }
}
