<?php

namespace App\Http\Requests\SuperAdmin;

use Illuminate\Foundation\Http\FormRequest;

/** Retry / delete failed jobs: { ids: ["uuid", …] } (the ticked rows, at most 50). */
class FailedJobIdsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // role:super_admin middleware
    }

    public function rules(): array
    {
        return [
            'ids' => ['required', 'array', 'min:1', 'max:50'],
            'ids.*' => ['required', 'string', 'max:255', 'distinct'],
        ];
    }

    public function messages(): array
    {
        return ['ids.required' => 'Tick at least one job.', 'ids.min' => 'Tick at least one job.'];
    }
}
