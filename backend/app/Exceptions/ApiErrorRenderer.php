<?php

namespace App\Exceptions;

use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Throwable;

/**
 * ONE STANDARD ERROR SHAPE for the whole API. Every error looks like:
 *
 *   {
 *     "message":    "Text a person can read (shown in toasts / error states)",
 *     "code":       "MACHINE_READABLE_CODE (the frontend can react to it)",
 *     "errors":     { "field": ["problem"] }   <- only for form errors (422)
 *     "request_id": "tracking number, matches the server logs"
 *   }
 *
 * The real technical details of a crash are NEVER sent to users (hackers love
 * them). They go to the log file, findable by request_id.
 */
class ApiErrorRenderer
{
    public static function render(Throwable $e, Request $request): JsonResponse
    {
        [$status, $code, $message, $errors] = match (true) {
            $e instanceof ApiException => [$e->status, $e->errorCode, $e->getMessage(), $e->errors],

            $e instanceof ValidationException => [422, 'VALIDATION_FAILED', 'Some fields need fixing. Please check the form.', $e->errors()],

            $e instanceof AuthenticationException => [401, 'UNAUTHENTICATED', 'Please log in to continue.', null],

            $e instanceof AuthorizationException,
            $e instanceof AccessDeniedHttpException => [403, 'FORBIDDEN', 'You do not have permission to do this.', null],

            $e instanceof ModelNotFoundException,
            $e instanceof NotFoundHttpException => [404, 'NOT_FOUND', 'We could not find what you are looking for.', null],

            $e instanceof ThrottleRequestsException => [429, 'TOO_MANY_REQUESTS', 'Too many attempts. Please wait a moment and try again.', null],

            $e instanceof HttpExceptionInterface => [
                $e->getStatusCode(),
                'HTTP_'.$e->getStatusCode(),
                $e->getStatusCode() < 500 && $e->getMessage() !== '' ? $e->getMessage() : 'Something went wrong. Please try again.',
                null,
            ],

            default => [500, 'SERVER_ERROR', 'Something went wrong on our side. Please try again.', null],
        };

        // e.g. "Retry-After" for 429 responses
        $headers = $e instanceof HttpExceptionInterface ? $e->getHeaders() : [];

        $body = array_filter([
            'message' => $message,
            'code' => $code,
            'errors' => $errors,
            'request_id' => $request->attributes->get('request_id'),
        ], fn ($value) => $value !== null);

        // Local development only: show the real cause to help debugging
        if ($status >= 500 && config('app.debug')) {
            $body['debug'] = [
                'exception' => $e::class,
                'message' => $e->getMessage(),
                'at' => $e->getFile().':'.$e->getLine(),
            ];
        }

        return response()->json($body, $status, $headers);
    }
}
