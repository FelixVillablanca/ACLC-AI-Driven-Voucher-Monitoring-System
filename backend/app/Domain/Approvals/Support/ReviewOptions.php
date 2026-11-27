<?php

namespace App\Domain\Approvals\Support;

/**
 * The fixed choices on the Return and Reject windows (Framer XT9f8T3lY, sozCOjfDk), 2026-11-26.
 * Return "What needs changes?" maps to the clerk's form sections. No "Attachments" tag yet: clerks
 * can't upload files until attachments are built (add it then).
 */
final class ReviewOptions
{
    public const NEEDS_CHANGES = [
        'payee' => 'Payee',
        'details' => 'Description',
        'category' => 'Category',
        'line_items' => 'Line items',
        'amount' => 'Amount',
        'payment' => 'Payment details',
    ];

    public const REJECT_REASONS = [
        'duplicate' => 'Duplicate of another voucher',
        'not_business' => 'Not a valid business expense',
        'not_allowed' => 'Not allowed by company policy',
        'no_budget' => 'No budget for this expense',
        'other' => 'Other reason',
    ];

    /** @param list<string>|null $keys  @return list<string> */
    public static function labels(?array $keys): array
    {
        return array_values(array_map(fn ($k) => self::NEEDS_CHANGES[$k] ?? $k, $keys ?? []));
    }
}
