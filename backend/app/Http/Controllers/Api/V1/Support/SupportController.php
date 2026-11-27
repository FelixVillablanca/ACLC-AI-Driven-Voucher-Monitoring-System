<?php

namespace App\Http\Controllers\Api\V1\Support;

use App\Domain\Identity\Account\SendSupportMessage;
use App\Http\Controllers\Controller;
use App\Http\Requests\Support\SendSupportMessageRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Help & guides (Framer V0J_GkScn help center, mudjUlcnp Contact support), 2026-11-26.
 * For clerks / officers / supervisors, inside the company in X-Company-ID.
 *   GET  /support/contacts   who gets your message: that company's Admin(s) (name + work email only)
 *   POST /support/messages   send it (bell notice + email to them), 5 a minute
 */
class SupportController extends Controller
{
    public function contacts(Request $request): JsonResponse
    {
        $company = $request->attributes->get('company');

        return response()->json(['data' => [
            'company' => $company->name,
            'admins' => SendSupportMessage::adminsOf($company)->map(fn ($a) => ['name' => $a->full_name, 'email' => $a->email])->all(),
            'topics' => collect(SendSupportMessage::topicsFor($request->user()->role))->map(fn ($label, $key) => ['key' => $key, 'label' => $label])->values()->all(),
        ]]);
    }

    public function store(SendSupportMessageRequest $request, SendSupportMessage $send): JsonResponse
    {
        $result = $send->send(
            $request->user(),
            $request->attributes->get('company'),
            $request->validated('topic'),
            $request->validated('message'),
            $request->validated('voucher_id'),
            $request->file('screenshot'),
            $request->ip(),
        );

        return response()->json(['data' => $result], 201);
    }
}
