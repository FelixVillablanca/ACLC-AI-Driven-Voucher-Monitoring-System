<?php

namespace App\Http\Requests\SuperAdmin;

use App\Domain\Identity\Support\RoleEmailDomains;
use App\Models\User;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * "Edit details" (Admins tab A9). Same rules as Create admin, except: the email may stay the same
 * (it is this person's own), and the personal email may be left empty for older accounts.
 */
class UpdateAdminRequest extends StoreAdminRequest
{
    public function rules(): array
    {
        return [
            ...parent::rules(),
            'personal_email' => ['nullable', 'string', 'max:255', 'email:rfc'],
            'company_id' => [
                // an Admin with no company yet may stay without one; once they have one it can be changed, not removed
                $this->route('user')?->company_id === null ? 'nullable' : 'required', 'integer',
                // Their CURRENT company stays allowed even if suspended now; a new one must be active
                Rule::exists('companies', 'id')->where(fn ($q) => $q->where('id', $this->route('user')?->company_id)
                    ->orWhere(fn ($q) => $q->where('is_active', true)->whereNull('suspended_at'))),
            ],
        ];
    }

    public function after(): array
    {
        return [
            function (Validator $validator) {
                if ($validator->errors()->isNotEmpty()) {
                    return;
                }
                if (User::where('email', $this->email())->whereKeyNot($this->route('user')?->id)->exists()) {
                    $validator->errors()->add('email_username', 'An account with this email already exists.');
                }
                $personal = (string) $this->input('personal_email');
                $domain = strtolower(substr((string) strrchr($personal, '@'), 1));
                if ($personal !== '' && in_array($domain, array_map('strtolower', RoleEmailDomains::DOMAINS), true)) {
                    $validator->errors()->add('personal_email', 'Use their personal email (e.g. Gmail), not a work sign-in address.');
                }
            },
        ];
    }

    /** The values to save. */
    public function adminValues(): array
    {
        return [
            'first_name' => $this->validated('first_name'),
            'last_name' => $this->validated('last_name'),
            'email' => $this->email(),
            'company_id' => $this->validated('company_id') === null ? null : (int) $this->validated('company_id'),
            'personal_email' => $this->validated('personal_email') ?: null,
        ];
    }
}
