<?php

namespace App\Http\Requests\SuperAdmin;

use App\Domain\Identity\Support\RoleEmailDomains;
use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * The rules for "Create admin account" (Framer TkIHF89oH).
 * Only the email NAME is sent (the server adds @Administrator.com) and the server assigns the
 * Employee ID. Since 2026-11-20: ONE company per Admin (active, not suspended), and a PERSONAL
 * email where the "set your password" link goes. No password is typed or sent.
 * Since 2026-11-28 the company is OPTIONAL (user decision): an Admin with no company yet waits until a Super
 * Admin gives them one (in "+ Add company" or Edit details); meanwhile the Admin console shows a waiting page.
 */
class StoreAdminRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // the route's `role:super_admin` middleware already checked this
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'first_name' => trim((string) $this->input('first_name')),
            'last_name' => trim((string) $this->input('last_name')),
            'email_username' => strtolower(trim((string) $this->input('email_username'))),
            'personal_email' => strtolower(trim((string) $this->input('personal_email'))),
            'company_id' => $this->input('company_id') === '' ? null : $this->input('company_id'), // "No company yet"
        ]);
    }

    /** "carlo.reyes" -> "carlo.reyes@Administrator.com" */
    public function email(): string
    {
        return RoleEmailDomains::emailFor((string) $this->input('email_username'), 'admin');
    }

    /** @return array<string, array<int, mixed>> */
    public function rules(): array
    {
        return [
            'first_name' => ['required', 'string', 'max:100'],
            'last_name' => ['required', 'string', 'max:100'],
            'email_username' => ['required', 'string', 'max:64', 'regex:'.RoleEmailDomains::USERNAME_PATTERN],
            'company_id' => [
                'nullable', 'integer',
                Rule::exists('companies', 'id')->where('is_active', true)->whereNull('suspended_at'),
            ],
            'personal_email' => ['required', 'string', 'max:255', 'email:rfc'],
        ];
    }

    public function after(): array
    {
        return [
            function (Validator $validator) {
                if ($validator->errors()->isNotEmpty()) {
                    return;
                }
                if (User::where('email', $this->email())->exists()) {
                    $validator->errors()->add('email_username', 'An account with this email already exists.');
                }
                // The personal email must be their OWN inbox, not a work sign-in address of this system
                $domain = strtolower(substr(strrchr((string) $this->input('personal_email'), '@'), 1));
                if (in_array($domain, array_map('strtolower', RoleEmailDomains::DOMAINS), true)) {
                    $validator->errors()->add('personal_email', 'Use their personal email (e.g. Gmail), not a work sign-in address.');
                }
            },
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'first_name.required' => 'Enter the first name.',
            'last_name.required' => 'Enter the last name.',
            'email_username.required' => 'Enter the email name (the part before @).',
            'email_username.regex' => 'Use only letters, numbers and . _ - (no spaces or @).',
            'email_username.max' => 'The email name can be at most 64 characters.',
            'company_id.required' => 'Choose the company this Admin will run.',
            'company_id.exists' => 'Choose an active company.',
            'personal_email.required' => 'Enter their personal email. The set-password link is sent there.',
            'personal_email.email' => 'Enter a valid email address, like name@gmail.com.',
        ];
    }
}
