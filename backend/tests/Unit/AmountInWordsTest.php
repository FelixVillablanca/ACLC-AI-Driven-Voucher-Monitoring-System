<?php

namespace Tests\Unit;

use App\Domain\Vouchers\Support\AmountInWords;
use PHPUnit\Framework\TestCase;

/** The "amount in words" line on the voucher and payment PDFs. Run: php artisan test --filter=AmountInWordsTest */
class AmountInWordsTest extends TestCase
{
    public function test_whole_pesos_end_with_only_and_no_00_100(): void
    {
        $this->assertSame('Five thousand pesos only', AmountInWords::pesos('5000.00'));
        $this->assertSame('One peso only', AmountInWords::pesos('1.00'));
        $this->assertSame('Two hundred fifty pesos only', AmountInWords::pesos('250'));
    }

    public function test_centavos_stay_as_a_fraction(): void
    {
        $this->assertSame('Twelve thousand three hundred forty-five pesos and 67/100', AmountInWords::pesos('12345.67'));
        $this->assertSame('One million pesos and 05/100', AmountInWords::pesos('1000000.05'));
        $this->assertSame('Zero pesos and 50/100', AmountInWords::pesos('0.50'));
    }
}
