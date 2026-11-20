<?php

namespace App\Http\Requests\SuperAdmin;

/** "Send password reset" (A10): { sign_out: true } = "Also sign them out everywhere now" (default on). */
class PasswordResetRequest extends AdminAccountActionRequest
{
    public function rules(): array
    {
        return [...parent::rules(), 'sign_out' => ['sometimes', 'boolean']];
    }
}
