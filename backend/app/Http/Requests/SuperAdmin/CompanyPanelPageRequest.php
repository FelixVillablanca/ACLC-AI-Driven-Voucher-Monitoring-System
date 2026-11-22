<?php

namespace App\Http\Requests\SuperAdmin;

use Illuminate\Foundation\Http\FormRequest;

/**
 * The company side panel's paged tabs (C8 Users / History): ?page=2
 */
class CompanyPanelPageRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // role:super_admin middleware
    }

    public function rules(): array
    {
        return ['page' => ['sometimes', 'integer', 'min:1']];
    }
}
