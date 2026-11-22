<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

/**
 * GET /api/v1/admin/search?q=... (the search box in the Admin top bar).
 * `q` = what was typed: at least 2 letters, so one letter doesn't list everyone.
 */
class AdminSearchRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // the route's `role:admin` middleware already checked this
    }

    protected function prepareForValidation(): void
    {
        $this->merge(['q' => trim((string) $this->input('q'))]);
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'q' => ['required', 'string', 'min:2', 'max:100'],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'q.required' => 'Type something to search for.',
            'q.min' => 'Type at least 2 letters.',
        ];
    }
}
