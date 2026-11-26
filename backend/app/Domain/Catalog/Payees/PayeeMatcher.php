<?php

namespace App\Domain\Catalog\Payees;

use App\Models\Payee;
use Illuminate\Support\Collection;

/**
 * "Is this payee already on the list?" (Add payee, Framer UKm7GrwEZ). Plain rules, not AI:
 *   same_tin     the same TIN                       → can't be saved (the TIN is unique per company)
 *   same_name    the same name once tidied up        ("Juans Catering Svcs." = "Juan's Catering Services")
 *   similar_name names that are at least 85% alike  (a typo or a shortened name)
 * same_name and similar_name are warnings: the clerk may still save a different payee with a new name.
 */
final class PayeeMatcher
{
    private const SIMILAR_PERCENT = 85;

    /** @return Collection<int, array{payee: Payee, reason: string}> */
    public function find(int $companyId, ?string $name, ?string $tin, ?int $ignoreId = null, int $limit = 3): Collection
    {
        $key = $name ? PayeeText::matchKey($name) : '';
        $digits = PayeeText::tinDigits($tin);
        if (strlen($digits) === 9) {
            $digits .= '000';
        }
        if (mb_strlen($key) < 3 && strlen($digits) < 9) {
            return collect();
        }

        return Payee::query()->with('type:id,name')->where('company_id', $companyId)
            ->when($ignoreId, fn ($q) => $q->whereKeyNot($ignoreId))
            ->get(['id', 'name', 'tin', 'payee_type_id', 'is_active'])
            ->map(function (Payee $p) use ($key, $digits) {
                if (strlen($digits) >= 9 && PayeeText::tinDigits($p->tin) === $digits) {
                    return ['payee' => $p, 'reason' => 'same_tin', 'score' => 101];
                }
                if ($key === '') {
                    return null;
                }
                $other = PayeeText::matchKey($p->name);
                if ($other === $key) {
                    return ['payee' => $p, 'reason' => 'same_name', 'score' => 100];
                }
                similar_text($key, $other, $percent);

                return $percent >= self::SIMILAR_PERCENT ? ['payee' => $p, 'reason' => 'similar_name', 'score' => $percent] : null;
            })
            ->filter()->sortByDesc('score')->take($limit)->values()
            ->map(fn ($m) => ['payee' => $m['payee'], 'reason' => $m['reason']]);
    }
}
