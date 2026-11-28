<?php

namespace App\Http\Requests\SuperAdmin;

use Illuminate\Foundation\Http\FormRequest;

/**
 * GET /api/v1/superadmin/places/search?q=  (the map search in "+ Add company")
 * 3 to 200 characters: shorter searches ("pa") would match half the country.
 */
class SearchPlacesRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // role:super_admin middleware
    }

    protected function prepareForValidation(): void
    {
        $q = $this->query('q');
        $this->merge(['q' => is_string($q) ? trim(preg_replace('/\s+/u', ' ', $q)) : $q]);
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return ['q' => ['required', 'string', 'min:3', 'max:200']];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'q.required' => 'Type a place or an address to search for.',
            'q.min' => 'Type at least 3 letters.',
            'q.max' => 'Use at most 200 characters.',
        ];
    }
}
