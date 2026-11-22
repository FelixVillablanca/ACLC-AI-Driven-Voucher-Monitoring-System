<?php

namespace App\Http\Requests\Admin;

use Illuminate\Database\Query\Builder;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * POST  /api/v1/admin/catalog/{kind}        add
 * PATCH /api/v1/admin/catalog/{kind}/{id}   edit (+ updated_at from when the form opened)
 *   categories:              { name, code?, description? }
 *   voucher_types / payee_types: { name }
 * Names (and category codes) are unique inside the Admin's company, letter case ignored; a category
 * also can't copy a built-in category's name or code. Another company may use the same names.
 */
class SaveCatalogItemRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // role:admin middleware
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'name' => is_string($this->name) ? trim(preg_replace('/\s+/u', ' ', $this->name)) : $this->name,
            'code' => is_string($this->code) ? (strtoupper(trim($this->code)) ?: null) : $this->code,
            'description' => is_string($this->description) ? (trim($this->description) ?: null) : $this->description,
        ]);
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        $kind = (string) $this->route('kind');
        $id = $this->route('id') ? (int) $this->route('id') : null;
        $companyId = (int) $this->user()?->company_id;
        $isCategory = $kind === 'categories';
        $table = ['categories' => 'voucher_categories', 'voucher_types' => 'voucher_types', 'payee_types' => 'payee_types'][$kind] ?? 'voucher_types';

        // own company's items (+ the built-in categories), never this item itself
        $scope = fn (Builder $q) => $isCategory
            ? $q->where(fn ($w) => $w->where('company_id', $companyId)->orWhereNull('company_id'))
            : $q->where('company_id', $companyId);

        $unique = fn (string $column) => Rule::unique($table, $column)->where($scope)->ignore($id);

        $rules = [
            'name' => ['required', 'string', 'min:2', 'max:'.($isCategory ? 100 : 150), $unique('name')],
            'updated_at' => ['nullable', 'string', 'max:40'],
        ];

        if ($isCategory) {
            $rules['code'] = ['nullable', 'string', 'max:20', 'regex:/^[A-Z0-9]+(-[A-Z0-9]+)*$/', $unique('code')];
            $rules['description'] = ['nullable', 'string', 'max:500'];
        }

        return $rules;
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'name.required' => 'Enter a name.',
            'name.min' => 'Use at least 2 characters.',
            'name.unique' => 'Your company already has one with this name.',
            'code.unique' => 'Your company already uses this code.',
            'code.regex' => 'Use capital letters and numbers, with - between parts (e.g. OFF or IT-EQ).',
        ];
    }
}
