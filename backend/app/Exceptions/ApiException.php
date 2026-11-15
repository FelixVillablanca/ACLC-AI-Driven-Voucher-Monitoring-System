<?php

namespace App\Exceptions;

use RuntimeException;

/**
 * Throw this for BUSINESS-RULE errors that the user should see, e.g.:
 *
 *   throw new ApiException('This voucher can no longer be approved.', 'VOUCHER_INVALID_TRANSITION', 409);
 *
 * It is turned into the standard error JSON automatically (see ApiErrorRenderer).
 */
class ApiException extends RuntimeException
{
    /**
     * @param  array<string, array<int, string>>|null  $errors  optional field errors
     */
    public function __construct(
        string $message,
        public readonly string $errorCode = 'BAD_REQUEST',
        public readonly int $status = 400,
        public readonly ?array $errors = null,
    ) {
        parent::__construct($message);
    }
}
