<?php

namespace App\Domain\Catalog\Payees;

/**
 * Small text rules for payees (2026-11-26).
 *  tin()      "000101528" / "000-101-528-000" → "000-101-528-000" (a 9-digit TIN gets the 000 branch code)
 *  matchKey() "Juan's Catering Svcs., Inc." → "juans catering services": the shape two names are compared in
 *  maskAccount() "3810-2245-91" → "••••4591" for the audit log (the full number stays on the payee only)
 */
final class PayeeText
{
    /** Words that don't make two businesses different ("ABC Trading Inc." = "ABC Trading"). */
    private const NOISE = ['inc', 'incorporated', 'corp', 'corporation', 'co', 'company', 'ltd', 'limited', 'llc', 'opc', 'the'];

    private const SAME = ['svcs' => 'services', 'svc' => 'service', 'svcs.' => 'services', 'intl' => 'international', 'mfg' => 'manufacturing', 'ent' => 'enterprises'];

    public static function tinDigits(?string $tin): string
    {
        return preg_replace('/\D/', '', (string) $tin);
    }

    public static function tin(?string $tin): ?string
    {
        $d = self::tinDigits($tin);
        if ($d === '') {
            return null;
        }
        if (strlen($d) === 9) {
            $d .= '000';
        }

        return strlen($d) === 12 ? implode('-', str_split($d, 3)) : $tin;
    }

    public static function matchKey(string $name): string
    {
        $s = mb_strtolower($name);
        $s = str_replace(['&', '’', "'"], [' and ', '', ''], $s);
        $s = preg_replace('/[^\p{L}\p{N}]+/u', ' ', $s);
        $words = array_filter(explode(' ', $s), fn ($w) => $w !== '' && ! in_array($w, self::NOISE, true));

        return implode(' ', array_map(fn ($w) => self::SAME[$w] ?? $w, $words));
    }

    public static function maskAccount(?string $number): ?string
    {
        $d = preg_replace('/\D/', '', (string) $number);

        return $d === '' ? null : '••••'.substr($d, -4);
    }
}
