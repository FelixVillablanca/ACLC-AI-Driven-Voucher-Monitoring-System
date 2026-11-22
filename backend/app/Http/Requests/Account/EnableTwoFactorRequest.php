<?php

namespace App\Http\Requests\Account;

use Illuminate\Foundation\Http\FormRequest;

/** Account settings → Turn on two-step: the first 6-digit code from the app. */
class EnableTwoFactorRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return ['code' => ['required', 'string', 'max:10']];
    }

    public function messages(): array
    {
        return ['code.required' => 'Type the 6 digits your app shows.'];
    }
}
