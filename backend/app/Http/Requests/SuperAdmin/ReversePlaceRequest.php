<?php

namespace App\Http\Requests\SuperAdmin;

use Illuminate\Foundation\Http\FormRequest;

/**
 * GET /api/v1/superadmin/places/reverse?lat=&lng=  (a click on the map or a dragged pin → the nearest address)
 */
class ReversePlaceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // role:super_admin middleware
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'lat' => ['required', 'numeric', 'between:-90,90'],
            'lng' => ['required', 'numeric', 'between:-180,180'],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'lat.*' => 'This map spot isn’t valid. Place the pin again.',
            'lng.*' => 'This map spot isn’t valid. Place the pin again.',
        ];
    }
}
