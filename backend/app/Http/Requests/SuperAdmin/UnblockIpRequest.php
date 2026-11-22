<?php

namespace App\Http\Requests\SuperAdmin;

use Illuminate\Foundation\Http\FormRequest;

/** Unblock (SH9): POST /api/v1/superadmin/blocked-ips/{block}/unblock  { watch: true } */
class UnblockIpRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // role:super_admin middleware
    }

    public function rules(): array
    {
        return ['watch' => ['sometimes', 'boolean']];
    }
}
