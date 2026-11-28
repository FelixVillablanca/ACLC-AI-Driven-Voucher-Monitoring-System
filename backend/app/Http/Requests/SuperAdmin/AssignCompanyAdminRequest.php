<?php

namespace App\Http\Requests\SuperAdmin;

use App\Domain\Identity\Queries\UnassignedAdmins;
use Illuminate\Foundation\Http\FormRequest;

/**
 * POST /api/v1/superadmin/companies/{company}/admin  { admin_id }
 * The company side panel's "Admin in charge": an Admin with no company yet becomes this company's Admin.
 */
class AssignCompanyAdminRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // role:super_admin middleware
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return ['admin_id' => ['required', 'integer', UnassignedAdmins::rule()]];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return ['admin_id.required' => 'Choose the Admin who will run this company.'];
    }
}
