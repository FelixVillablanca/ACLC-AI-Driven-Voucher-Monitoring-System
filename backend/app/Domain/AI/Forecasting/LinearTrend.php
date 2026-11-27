<?php

namespace App\Domain\AI\Forecasting;

/**
 * LINEAR REGRESSION (ordinary least squares) on a monthly series, 2026-11-27. Pure math, no database.
 * It draws the straight line that is closest to all the months (y = intercept + slope·x, x = 0, 1, 2 …) and
 * extends it into the future. This is the method the plan names for budget forecasting; Phase 5's Python
 * model replaces it later.
 *
 *   $t = LinearTrend::fit([120000, 135000, 128000, 150000]);
 *   $t->predict(5)   → ['value' => …, 'lower' => …, 'upper' => …, 'confidence' => 0–1]
 *   $t->rSquared     → how well the line fits the history (1 = perfectly, 0 = not at all)
 *
 * The range is an 80% PREDICTION INTERVAL: spending should land inside it about 4 times out of 5 if the
 * trend keeps going. "Confidence" = how narrow that range is compared with the prediction
 * (1 − half the range ÷ the prediction), so a wide range means low confidence.
 * Statistics are done in floats (an estimate, not a ledger amount); results are rounded to centavos.
 */
final class LinearTrend
{
    public const MIN_MONTHS = 3;

    private const Z_80 = 1.2816; // 80% of a normal distribution lies within ±1.2816 standard deviations

    private function __construct(
        public readonly int $n,
        public readonly float $slope,
        public readonly float $intercept,
        public readonly float $rSquared,
        private readonly float $stdError,
        private readonly float $meanX,
        private readonly float $sxx,
    ) {}

    /** @param list<float|int|string> $values one value per month, oldest first (needs MIN_MONTHS) */
    public static function fit(array $values): ?self
    {
        $y = array_map('floatval', array_values($values));
        $n = count($y);
        if ($n < self::MIN_MONTHS) {
            return null;
        }
        $meanX = ($n - 1) / 2;
        $meanY = array_sum($y) / $n;
        $sxx = $sxy = $sst = 0.0;
        foreach ($y as $x => $v) {
            $sxx += ($x - $meanX) ** 2;
            $sxy += ($x - $meanX) * ($v - $meanY);
            $sst += ($v - $meanY) ** 2;
        }
        $slope = $sxy / $sxx;
        $intercept = $meanY - $slope * $meanX;
        $sse = 0.0;
        foreach ($y as $x => $v) {
            $sse += ($v - ($intercept + $slope * $x)) ** 2;
        }
        $r2 = $sst > 0 ? max(0.0, 1 - $sse / $sst) : ($sse == 0.0 ? 1.0 : 0.0);

        return new self($n, $slope, $intercept, $r2, sqrt($sse / ($n - 2)), $meanX, $sxx);
    }

    /** @return array{value: string, lower: string, upper: string, confidence: float} for month index $x */
    public function predict(int $x): array
    {
        $raw = $this->intercept + $this->slope * $x;
        $half = self::Z_80 * $this->stdError * sqrt(1 + 1 / $this->n + (($x - $this->meanX) ** 2) / $this->sxx);
        $value = max(0.0, $raw);
        $confidence = $value > 0 ? max(0.0, min(1.0, 1 - $half / $value)) : 0.0;

        return [
            'value' => number_format($value, 2, '.', ''),
            'lower' => number_format(max(0.0, $raw - $half), 2, '.', ''),
            'upper' => number_format(max(0.0, $raw + $half), 2, '.', ''),
            'confidence' => round($confidence, 4),
        ];
    }
}
