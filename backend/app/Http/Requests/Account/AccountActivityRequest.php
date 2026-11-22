<?php

namespace App\Http\Requests\Account;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/** My activity: ?type=all|security|changes&page=2 */
class AccountActivityRequest extends FormRequest
{
    public const TYPES = ['all', 'security', 'changes'];

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'type' => ['sometimes', Rule::in(self::TYPES)],
            'page' => ['sometimes', 'integer', 'min:1', 'max:10000'],
        ];
    }
}
