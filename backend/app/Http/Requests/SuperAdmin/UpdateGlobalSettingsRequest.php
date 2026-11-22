<?php

namespace App\Http\Requests\SuperAdmin;

use App\Domain\Platform\GlobalSettingRules;
use App\Domain\Platform\SystemSettings;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Validator as LaravelValidator;

/**
 * "Save changes" (G3): PUT /api/v1/superadmin/settings
 *   {
 *     changes: [{ key: "approval.high_value_threshold", value: "50000.00", was: "25000.00" }, …],
 *     reason: "Q4 approval policy update…",   (required, shown in Change history)
 *     notify_admins: true,
 *     password: "…"                            (the Super Admin's own password, again)
 *   }
 * `was` = the value the screen loaded; it lets the server notice someone else saved meanwhile (409).
 * A list (not an object keyed by setting) because the keys contain dots.
 */
class UpdateGlobalSettingsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // role:super_admin middleware
    }

    public function rules(): array
    {
        return [
            'changes' => ['required', 'array', 'min:1', 'max:'.count(SystemSettings::DEFAULTS)],
            'changes.*.key' => ['required', 'string', 'distinct', 'in:'.implode(',', array_keys(SystemSettings::DEFAULTS))],
            'changes.*.value' => ['present'],
            'changes.*.was' => ['present'],
            'reason' => ['required', 'string', 'min:5', 'max:500'],
            'notify_admins' => ['sometimes', 'boolean'],
            'password' => ['required', 'string', 'current_password:web'],
        ];
    }

    /** Each value is checked with ITS setting's own rules (GlobalSettingRules). */
    public function after(): array
    {
        return [function (LaravelValidator $validator) {
            foreach ((array) $this->input('changes', []) as $i => $change) {
                $key = $change['key'] ?? null;
                if (! is_string($key) || ! array_key_exists($key, SystemSettings::DEFAULTS)) {
                    continue; // already reported by changes.*.key
                }
                $check = Validator::make(['value' => $change['value'] ?? null], ['value' => GlobalSettingRules::rules($key)]);
                foreach ($check->errors()->get('value') as $message) {
                    $label = SystemSettings::DEFAULTS[$key]['label'];
                    $validator->errors()->add("changes.$i.value", str_replace('value', $label, $message));
                }
            }
        }];
    }

    /**
     * The changes in their STORED form: money "50000.00", numbers int, switches bool.
     *
     * @return array<int, array{key: string, value: mixed, was: mixed}>
     */
    public function changes(): array
    {
        return array_map(fn (array $c) => [
            'key' => $c['key'],
            'value' => GlobalSettingRules::normalize($c['key'], $c['value']),
            'was' => $c['was'] === null ? null : GlobalSettingRules::normalize($c['key'], $c['was']),
        ], $this->validated('changes'));
    }

    public function messages(): array
    {
        return [
            'reason.required' => 'Say why you are making this change.',
            'reason.min' => 'Say a little more about why (at least 5 characters).',
            'password.required' => 'Type your password to confirm.',
            'password.current_password' => 'That password is not correct.',
            'changes.required' => 'There are no changes to save.',
        ];
    }
}
