<?php

namespace App\Http\Requests\SuperAdmin;

use Illuminate\Foundation\Http\FormRequest;

/** "✓ Mark resolved" (SH10): POST /api/v1/superadmin/system-health/incidents/{incident}/resolve  { note } */
class ResolveIncidentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // role:super_admin middleware
    }

    public function rules(): array
    {
        return ['note' => ['required', 'string', 'min:5', 'max:1000']];
    }

    public function messages(): array
    {
        return [
            'note.required' => 'Write what fixed it before marking it resolved.',
            'note.min' => 'Say a little more (at least 5 characters).',
        ];
    }
}
