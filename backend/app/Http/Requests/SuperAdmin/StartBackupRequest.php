<?php

namespace App\Http\Requests\SuperAdmin;

use Illuminate\Foundation\Http\FormRequest;

/** POST /api/v1/superadmin/backups  { notify: true }  ("Notify me when it finishes") */
class StartBackupRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // role:super_admin middleware
    }

    public function rules(): array
    {
        return [
            'notify' => ['sometimes', 'boolean'],
        ];
    }
}
