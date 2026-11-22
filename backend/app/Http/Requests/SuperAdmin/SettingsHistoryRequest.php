<?php

namespace App\Http\Requests\SuperAdmin;

use App\Domain\Platform\SystemSettings;
use Illuminate\Foundation\Http\FormRequest;

/**
 * "Change history" (G1): GET /api/v1/superadmin/settings/history?group=approval&page=2
 */
class SettingsHistoryRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // role:super_admin middleware
    }

    public function rules(): array
    {
        return [
            'group' => ['sometimes', 'nullable', 'in:'.implode(',', SystemSettings::GROUPS)],
            'page' => ['sometimes', 'integer', 'min:1'],
        ];
    }
}
