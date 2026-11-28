<?php

namespace App\Http\Requests\Vouchers;

use Illuminate\Foundation\Http\FormRequest;

/**
 * POST /api/v1/cheques/{cheque}/release { received_by } · /clear { cleared_on } · /cancel { reason }
 * (cheque register, 2026-11-29). Which field is needed follows the route's last part.
 */
class ChequeStepRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // role:accounting_clerk + company; only cheques of the clerk's own vouchers are found
    }

    private function step(): string
    {
        return (string) str($this->route()?->getName())->afterLast('.');
    }

    protected function prepareForValidation(): void
    {
        foreach (['received_by', 'reason'] as $key) {
            if (is_string($v = $this->input($key))) {
                $this->merge([$key => trim(preg_replace('/\s+/', ' ', $v))]);
            }
        }
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return match ($this->step()) {
            'release' => ['received_by' => ['required', 'string', 'min:2', 'max:150']],
            'clear' => ['cleared_on' => ['required', 'date_format:Y-m-d', 'before_or_equal:today']],
            'cancel' => ['reason' => ['required', 'string', 'min:3', 'max:255']],
            default => [],
        };
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'received_by.required' => 'Type the name of the person who picked up the cheque.',
            'received_by.min' => 'Type the name of the person who picked up the cheque.',
            'received_by.max' => 'Keep the name under 150 characters.',
            'cleared_on.required' => 'Choose the day the bank paid the cheque.',
            'cleared_on.date_format' => 'Choose the day the bank paid the cheque.',
            'cleared_on.before_or_equal' => 'The clearing date can’t be in the future.',
            'reason.required' => 'Say why the cheque is cancelled (for example: spoiled, lost, wrong amount).',
            'reason.min' => 'Say why the cheque is cancelled (for example: spoiled, lost, wrong amount).',
            'reason.max' => 'Keep the reason under 255 characters.',
        ];
    }
}
