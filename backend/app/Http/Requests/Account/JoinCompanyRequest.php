<?php

namespace App\Http\Requests\Account;

use Illuminate\Foundation\Http\FormRequest;

/**
 * POST /api/v1/me/company-access/requests  { company_id, message? }
 * A clerk / officer / supervisor asks to work in another company. That company's Admin answers.
 */
class JoinCompanyRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // role middleware: clerks, officers, supervisors
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->message)) {
            $this->merge(['message' => trim($this->message) ?: null]);
        }
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'company_id' => ['required', 'integer'],
            'message' => ['nullable', 'string', 'max:500'],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return ['company_id.required' => 'Choose the company you want to join.', 'message.max' => 'Keep the message under 500 characters.'];
    }
}
