<?php

namespace App\Domain\Vouchers\Support;

/**
 * Money maths for vouchers, done on TEXT with bcmath, never with floats (0.1 + 0.2 ≠ 0.3 in floats).
 * All amounts are strings with 2 decimals, e.g. "18450.00", the same as the DECIMAL(15,2) columns.
 */
final class VoucherMoney
{
    /** quantity × unit price, rounded half-up to centavos: "2.5" × "19.99" = "49.98" (49.975 → 49.98). */
    public static function lineTotal(string $quantity, string $unitPrice): string
    {
        return self::round2(bcmul($quantity, $unitPrice, 6));
    }

    /** @param  list<string>  $amounts */
    public static function sum(array $amounts): string
    {
        return array_reduce($amounts, fn (string $carry, string $a) => bcadd($carry, $a, 2), '0.00');
    }

    /** Half-up rounding to 2 decimals for non-negative amounts. */
    public static function round2(string $value): string
    {
        return bcadd($value, '0.005', 2);
    }
}
