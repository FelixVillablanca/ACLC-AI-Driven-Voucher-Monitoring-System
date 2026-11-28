<?php

namespace App\Http\Requests\Vouchers;

use App\Domain\Vouchers\Cheques\ChequeRules;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Carbon;

/**
 * POST /api/v1/vouchers/{voucher}/cheques  { cheque_number, cheque_date, bank_name }  (cheque register, 2026-11-29)
 * A post-dated cheque is fine (up to 180 days ahead); a date already 180 days old would be stale at once.
 */
class RecordChequeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // role:accounting_clerk + company; only the clerk's own vouchers are found
    }

    protected function prepareForValidation(): void
    {
        $clean = fn ($v) => is_string($v) ? preg_replace('/\s+/', ' ', trim($v)) : $v;
        $this->merge([
            'cheque_number' => is_string($n = $this->input('cheque_number')) ? preg_replace('/\s+/', '', $n) : $n,
            'bank_name' => $clean($this->input('bank_name')),
        ]);
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        $earliest = Carbon::today()->subDays(ChequeRules::STALE_DAYS - 1)->toDateString();
        $latest = Carbon::today()->addDays(ChequeRules::MAX_DAYS_AHEAD)->toDateString();

        return [
            'cheque_number' => ['required', 'string', 'max:30', 'regex:/^[A-Za-z0-9-]+$/'],
            'cheque_date' => ['required', 'date_format:Y-m-d', "after_or_equal:{$earliest}", "before_or_equal:{$latest}"],
            'bank_name' => ['required', 'string', 'min:2', 'max:150'],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'cheque_number.required' => 'Type the number printed on the cheque.',
            'cheque_number.regex' => 'Use only the letters, digits and dashes printed on the cheque.',
            'cheque_number.max' => 'A cheque number is at most 30 characters.',
            'cheque_date.required' => 'Choose the date written on the cheque.',
            'cheque_date.date_format' => 'Choose the date written on the cheque.',
            'cheque_date.after_or_equal' => 'A cheque this old is already stale. Write a new cheque with a recent date.',
            'cheque_date.before_or_equal' => 'A post-dated cheque can be at most '.ChequeRules::MAX_DAYS_AHEAD.' days ahead.',
            'bank_name.required' => 'Type the bank the cheque is drawn on.',
            'bank_name.min' => 'Type the bank the cheque is drawn on.',
            'bank_name.max' => 'Keep the bank name under 150 characters.',
        ];
    }
}
