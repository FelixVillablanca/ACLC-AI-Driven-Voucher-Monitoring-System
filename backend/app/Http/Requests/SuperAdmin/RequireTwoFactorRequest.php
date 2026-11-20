<?php

namespace App\Http\Requests\SuperAdmin;

use App\Domain\Identity\Actions\RequireTwoFactor;
use Illuminate\Foundation\Http\FormRequest;

/** "Require two-step sign-in" (A11): { setup_days: 1|3|7, email_steps: true } */
class RequireTwoFactorRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'setup_days' => ['required', 'integer', 'in:'.implode(',', RequireTwoFactor::SETUP_DAYS)],
            'email_steps' => ['sometimes', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return ['setup_days.in' => 'Choose 1, 3 or 7 days.'];
    }
}
