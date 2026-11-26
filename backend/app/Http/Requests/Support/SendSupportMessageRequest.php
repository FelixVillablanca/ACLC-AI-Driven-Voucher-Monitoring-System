<?php

namespace App\Http\Requests\Support;

use App\Domain\Identity\Account\SendSupportMessage;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * POST /api/v1/support/messages (multipart when a screenshot is sent).
 * topic + message required; voucher_id = one of YOUR vouchers in this company; screenshot = an image ≤ 5 MB.
 */
class SendSupportMessageRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // operational roles + company middleware
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->message)) {
            $this->merge(['message' => trim($this->message)]);
        }
        if ($this->voucher_id === '' || $this->voucher_id === 'null') {
            $this->merge(['voucher_id' => null]);
        }
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'topic' => ['required', Rule::in(array_keys(SendSupportMessage::TOPICS))],
            'message' => ['required', 'string', 'min:10', 'max:3000'],
            'voucher_id' => ['nullable', 'integer', Rule::exists('vouchers', 'id')
                ->where('company_id', $this->attributes->get('company')?->id)
                ->where('created_by', $this->user()?->id)],
            'screenshot' => ['nullable', 'file', 'image', 'mimes:png,jpg,jpeg,webp', 'max:5120'],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'topic.required' => 'Choose a topic.',
            'message.required' => 'Tell us what you need help with.',
            'message.min' => 'Add a little more detail (at least 10 characters).',
            'voucher_id.exists' => 'Choose one of your vouchers in this company.',
            'screenshot.image' => 'Attach a PNG, JPG or WebP image.',
            'screenshot.mimes' => 'Attach a PNG, JPG or WebP image.',
            'screenshot.max' => 'The screenshot must be 5 MB or smaller.',
        ];
    }
}
