<?php

namespace App\Http\Requests\Notifications;

use App\Domain\Notifications\NotificationType;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Checks the list filters:
 *   ?filter[unread]=1            only unread ("Unread" tab)
 *   ?filter[category]=security   only one category ("Security" tab)
 *   ?per_page=15                 how many per page (max 50)
 */
class ListNotificationsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // every signed-in user may read THEIR OWN notifications
    }

    /** @return array<string, array<int, mixed>> */
    public function rules(): array
    {
        return [
            'filter' => ['sometimes', 'array'],
            'filter.unread' => ['sometimes', 'boolean'],
            'filter.category' => ['sometimes', 'string', Rule::in(NotificationType::categories())],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:50'],
            'cursor' => ['sometimes', 'string'],
        ];
    }
}
