<?php

namespace App\Http\Requests\SuperAdmin;

use App\Domain\Security\Actions\BlockIpAddress;
use Illuminate\Foundation\Http\FormRequest;

/**
 * "Block 180.190.77.4?" (AL8): POST /api/v1/superadmin/blocked-ips
 *   { ip_address, duration: 24h|7d|forever, reason, notify_accounts }
 */
class BlockIpRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // role:super_admin middleware
    }

    public function rules(): array
    {
        return [
            'ip_address' => ['required', 'ip'],
            'duration' => ['required', 'in:'.implode(',', array_keys(BlockIpAddress::DURATIONS))],
            'reason' => ['required', 'string', 'min:5', 'max:500'],
            'notify_accounts' => ['sometimes', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'ip_address.ip' => 'That isn’t a valid IP address.',
            'reason.required' => 'Say why you are blocking this address.',
            'reason.min' => 'Say a little more about why (at least 5 characters).',
        ];
    }
}
