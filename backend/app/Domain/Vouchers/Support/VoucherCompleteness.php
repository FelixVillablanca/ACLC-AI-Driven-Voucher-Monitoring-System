<?php

namespace App\Domain\Vouchers\Support;

use App\Models\Voucher;

/**
 * "Is this voucher ready for a reviewer?" in ONE place. Submit refuses with these errors, and the Drafts
 * cards show the same answer as "3 of 4 sections complete · Missing: payee, lines", so the two can never
 * disagree. The sections are the cards on the voucher form: Payee, Details, Payment, Lines.
 * (Attachments become a 5th section when uploads are built.)
 */
final class VoucherCompleteness
{
    public const SECTIONS = ['payee' => 'payee', 'details' => 'details', 'payment' => 'bank details', 'lines' => 'lines'];

    /**
     * `errors` use the form's field names, so Submit's 422 lands under the right inputs.
     *
     * @return array{done: int, total: int, missing: list<string>, errors: array<string, string>}
     */
    public static function check(Voucher $voucher, int $lineCount): array
    {
        $errors = [];
        $failed = [];

        if (! $voucher->payee_name) {
            $errors['payee_name'] = 'Enter who gets paid.';
            $failed['payee'] = true;
        }
        if (! $voucher->payee_type_id) {
            $errors['payee_type_id'] = 'Choose the payee type.';
            $failed['payee'] = true;
        }
        if (! $voucher->category_id) {
            $errors['category_id'] = 'Choose a category.';
            $failed['details'] = true;
        }
        if (! $voucher->description && ! $voucher->purpose) {
            $errors['description'] = 'Say what this voucher is for.';
            $failed['details'] = true;
        }
        if ($voucher->payment_method === 'bank' && (! $voucher->bank_name || ! $voucher->bank_account_number || ! $voucher->bank_account_name)) {
            $errors['bank_name'] = 'Bank transfers need the bank, account number and account name.';
            $failed['payment'] = true;
        }
        if ($lineCount === 0) {
            $errors['line_items'] = 'Add at least one line.';
            $failed['lines'] = true;
        } elseif (bccomp((string) $voucher->amount, '0.00', 2) <= 0) {
            $errors['line_items'] = 'The total must be more than ₱0.00.';
            $failed['lines'] = true;
        }

        $missing = array_values(array_intersect_key(self::SECTIONS, $failed));

        return [
            'done' => count(self::SECTIONS) - count($missing),
            'total' => count(self::SECTIONS),
            'missing' => $missing,
            'errors' => $errors,
        ];
    }
}
