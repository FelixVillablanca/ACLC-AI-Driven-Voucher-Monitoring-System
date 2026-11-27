<?php

namespace App\Domain\Vouchers\Support;

/**
 * "12345.67" → "Twelve thousand three hundred forty-five pesos and 67/100", the line printed on a
 * Philippine voucher. Works on the DECIMAL string (never a float). Up to 999 billion.
 */
final class AmountInWords
{
    private const ONES = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
        'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];

    private const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

    private const SCALES = ['', 'thousand', 'million', 'billion'];

    public static function pesos(string $amount): string
    {
        [$whole, $cents] = array_pad(explode('.', $amount, 2), 2, '0');
        $whole = ltrim($whole, '0') ?: '0';
        $cents = str_pad(substr($cents, 0, 2), 2, '0');

        $words = $whole === '0' ? 'zero' : self::number($whole);

        return ucfirst($words).' '.($whole === '1' ? 'peso' : 'pesos')." and {$cents}/100";
    }

    private static function number(string $digits): string
    {
        $groups = array_reverse(str_split(str_pad($digits, (int) ceil(strlen($digits) / 3) * 3, '0', STR_PAD_LEFT), 3));
        $parts = [];
        foreach ($groups as $i => $group) {
            $n = (int) $group;
            if ($n === 0) {
                continue;
            }
            $parts[] = trim(self::hundreds($n).' '.(self::SCALES[$i] ?? ''));
        }

        return implode(' ', array_reverse($parts));
    }

    private static function hundreds(int $n): string
    {
        $out = [];
        if ($n >= 100) {
            $out[] = self::ONES[intdiv($n, 100)].' hundred';
            $n %= 100;
        }
        if ($n >= 20) {
            $out[] = self::TENS[intdiv($n, 10)].($n % 10 ? '-'.self::ONES[$n % 10] : '');
        } elseif ($n > 0) {
            $out[] = self::ONES[$n];
        }

        return implode(' ', $out);
    }
}
