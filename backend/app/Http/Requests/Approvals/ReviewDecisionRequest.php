<?php

namespace App\Http\Requests\Approvals;

use App\Domain\Approvals\Support\ReviewOptions;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * POST /api/v1/officer/vouchers/{id}/approve | return | reject   (one request class, rules per route)
 *   approve: remarks optional (a note for the Supervisor when it goes to step 2)
 *   return:  needs_changes (1+ of ReviewOptions::NEEDS_CHANGES) + remarks required
 *   reject:  reason (one of ReviewOptions::REJECT_REASONS) + remarks required
 * Remarks are what the clerk reads, so "required" means at least 5 real characters.
 */
class ReviewDecisionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // role:accounting_officer + company middleware
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->remarks)) {
            $this->merge(['remarks' => trim($this->remarks) ?: null]);
        }
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return match ($this->decision()) {
            'return' => [
                'needs_changes' => ['required', 'array', 'min:1', 'max:'.count(ReviewOptions::NEEDS_CHANGES)],
                'needs_changes.*' => ['distinct', Rule::in(array_keys(ReviewOptions::NEEDS_CHANGES))],
                'remarks' => ['required', 'string', 'min:5', 'max:2000'],
                'ai_finding' => ['nullable', Rule::in(['needs_changes'])], // Investigate → "Needs changes"
                // Supervisor (Level 2, 2026-11-27): back to the clerk or to Accounting
                'send_to' => [$this->is('api/v1/supervisor/*') ? 'required' : 'prohibited', Rule::in(['clerk', 'accounting'])],
            ],
            'reject' => [
                'reason' => ['required', Rule::in(array_keys(ReviewOptions::REJECT_REASONS))],
                'remarks' => ['required', 'string', 'min:5', 'max:2000'],
            ],
            'normal' => ['note' => ['nullable', 'string', 'max:2000']], // flagged: "False alarm"
            default => [
                'remarks' => ['nullable', 'string', 'max:2000'],
                'ai_finding' => ['nullable', Rule::in(['valid_high'])], // Investigate → "Valid but high"
            ],
        };
    }

    public function decision(): string
    {
        return (string) str($this->path())->afterLast('/');
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'needs_changes.required' => 'Pick at least one thing the clerk needs to change.',
            'needs_changes.min' => 'Pick at least one thing the clerk needs to change.',
            'send_to.required' => 'Choose who gets it back: Accounting or the clerk.',
            'reason.required' => 'Choose a reason.',
            'remarks.required' => $this->decision() === 'reject' ? 'Remarks are required to reject.' : 'Tell the clerk exactly what to fix.',
            'remarks.min' => 'Write a little more so the clerk knows what to do (at least 5 characters).',
        ];
    }
}
