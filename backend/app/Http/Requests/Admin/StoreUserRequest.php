<?php

namespace App\Http\Requests\Admin;

use App\Domain\Identity\Support\RoleEmailDomains;
use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * The rules for the "Create user" form (Framer lmhV2DJV1).
 *
 * - Employee ID is NOT sent: the server assigns it (EMP-2026-0001…).
 * - Email: only the NAME part is sent (`email_username`). The server adds the
 *   role's domain (@Clerk.com, @Administrator.com…; see RoleEmailDomains),
 *   so the domain can never be changed.
 * - The password is generated in the form (letters + numbers) and checked here.
 * - Department is optional (agreed 2026-11-16: companies may have none yet),
 *   but if given it must belong to the Admin's company.
 * - Admins can NOT create Admin accounts (spec §4.5, done 2026-11-20). Only a Super Admin
 *   can, from the Super Admin console. So the roles here are the 3 operational ones,
 *   and every new user needs company access.
 * - No company fields (2026-11-22): the user always joins the Admin's own company and gets
 *   access to it automatically (CreateUser). A company sent from the browser is ignored.
 */
class StoreUserRequest extends FormRequest
{
    /** The roles an Admin may create. */
    public const ROLES = ['accounting_clerk', 'accounting_officer', 'supervisor_manager'];

    public function authorize(): bool
    {
        return true; // the route's `role:admin` middleware already checked this
    }

    /** Tidy the input BEFORE checking it: trim spaces, lower-case the email name. */
    protected function prepareForValidation(): void
    {
        $this->merge([
            'first_name' => trim((string) $this->input('first_name')),
            'last_name' => trim((string) $this->input('last_name')),
            'email_username' => strtolower(trim((string) $this->input('email_username'))),
        ]);
    }

    /** The full email built from the name + the role's domain, e.g. "maria.santos@Clerk.com". */
    public function email(): ?string
    {
        return RoleEmailDomains::emailFor((string) $this->input('email_username'), (string) $this->input('role'));
    }

    /** @return array<string, array<int, mixed>> */
    public function rules(): array
    {
        // The company is NOT sent (2026-11-22): every new user joins the Admin's own company,
        // with access to it, so the department must be one of that company's departments.
        $companyId = (int) $this->user()?->company_id;

        return [
            'first_name' => ['required', 'string', 'max:100'],
            'last_name' => ['required', 'string', 'max:100'],
            'email_username' => ['required', 'string', 'max:64', 'regex:'.RoleEmailDomains::USERNAME_PATTERN],
            // At least 12 characters, with at least one letter AND one number
            'password' => ['required', 'string', 'min:12', 'max:64', 'regex:/[A-Za-z]/', 'regex:/[0-9]/'],
            'role' => ['required', Rule::in(self::ROLES)],
            'department_id' => [
                'nullable',
                'integer',
                Rule::exists('departments', 'id')->where('company_id', $companyId),
            ],
        ];
    }

    /** Extra check that needs several fields at once. */
    public function after(): array
    {
        return [
            function (Validator $validator) {
                if ($validator->errors()->isNotEmpty()) {
                    return;
                }
                // Case-insensitive: "Maria.Santos@clerk.com" and "maria.santos@Clerk.com" are the same person
                if (User::where('email', $this->email())->exists()) {
                    $validator->errors()->add('email_username', 'A user with this email already exists.');
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
            'password.required' => 'Generate a password.',
            'password.min' => 'The password must be at least 12 characters.',
            'password.regex' => 'The password must contain both letters and numbers.',
            'role.required' => 'Choose a role.',
            'role.in' => 'Choose Clerk, Officer or Supervisor. Admin accounts are created by a Super Admin.',
            'department_id.exists' => 'Choose a department of your company.',
        ];
    }
}
