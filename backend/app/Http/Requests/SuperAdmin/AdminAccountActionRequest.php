<?php

namespace App\Http\Requests\SuperAdmin;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Reset password / Unlock on an Admin account.
 * security_alert_id (optional) = the alert the action came from; it gets marked reviewed.
 */
class AdminAccountActionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'security_alert_id' => ['nullable', 'integer', 'exists:security_alerts,id'],
        ];
    }
}
