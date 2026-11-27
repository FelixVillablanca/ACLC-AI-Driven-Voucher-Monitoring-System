<?php

namespace App\Domain\Reporting\Support;

use Illuminate\Support\Carbon;
use InvalidArgumentException;

/**
 * The period of a financial report (2026-11-27). Calendar months / quarters; a department report ("custom")
 * takes any dates up to one year. The PREVIOUS period (for "▲ 12% vs September") is the same length right
 * before it: the month before, the quarter before, or the same number of days before.
 */
final class ReportPeriod
{
    private function __construct(
        public readonly string $type,
        public readonly Carbon $start,
        public readonly Carbon $end,
        public readonly Carbon $previousStart,
        public readonly Carbon $previousEnd,
        public readonly string $label,
        public readonly string $previousLabel,
    ) {}

    /** monthly: "2026-10" · quarterly: "2026-Q3" · custom: $from + $to (Y-m-d) */
    public static function make(string $type, ?string $period, ?string $from = null, ?string $to = null): self
    {
        return match ($type) {
            'monthly' => self::month($period),
            'quarterly' => self::quarter($period),
            'custom' => self::custom($from, $to),
            default => throw new InvalidArgumentException("Unknown report type {$type}"),
        };
    }

    private static function month(?string $period): self
    {
        if (! preg_match('/^(\d{4})-(\d{2})$/', (string) $period, $m)) {
            throw new InvalidArgumentException('Pick a month.');
        }
        $start = Carbon::create((int) $m[1], (int) $m[2], 1)->startOfDay();
        $prev = $start->copy()->subMonthNoOverflow();

        return new self('monthly', $start, $start->copy()->endOfMonth(), $prev, $prev->copy()->endOfMonth(), $start->format('F Y'), $prev->format('F'));
    }

    private static function quarter(?string $period): self
    {
        if (! preg_match('/^(\d{4})-Q([1-4])$/', (string) $period, $m)) {
            throw new InvalidArgumentException('Pick a quarter.');
        }
        $start = Carbon::create((int) $m[1], ((int) $m[2] - 1) * 3 + 1, 1)->startOfDay();
        $prev = $start->copy()->subMonthsNoOverflow(3);

        return new self('quarterly', $start, $start->copy()->addMonthsNoOverflow(2)->endOfMonth(), $prev, $prev->copy()->addMonthsNoOverflow(2)->endOfMonth(),
            "Q{$m[2]} {$m[1]}", 'Q'.$prev->quarter.' '.$prev->year);
    }

    private static function custom(?string $from, ?string $to): self
    {
        $start = Carbon::parse((string) $from)->startOfDay();
        $end = Carbon::parse((string) $to)->endOfDay();
        $days = (int) $start->diffInDays($end->copy()->startOfDay()) + 1;
        $prevEnd = $start->copy()->subDay()->endOfDay();
        $prevStart = $prevEnd->copy()->subDays($days - 1)->startOfDay();
        $label = $start->isSameYear($end) ? $start->format('M j').' – '.$end->format('M j, Y') : $start->format('M j, Y').' – '.$end->format('M j, Y');

        return new self('custom', $start, $end, $prevStart, $prevEnd, $label, 'the '.$days.' days before');
    }

    /** "Oct 1 – Oct 31" */
    public function rangeText(): string
    {
        return $this->start->format('M j').' – '.$this->end->format('M j');
    }

    /** The report's title, e.g. "October 2026 · Monthly expense report" / "IT & Systems · Oct 1 – Nov 10, 2026". */
    public function title(?string $department): string
    {
        return match ($this->type) {
            'monthly' => $department ? "{$department} · {$this->label} monthly report" : "{$this->label} · Monthly expense report",
            'quarterly' => $department ? "{$department} · {$this->label} quarterly report" : "{$this->label} · Quarterly report",
            default => ($department ?? 'All departments').' · '.$this->label,
        };
    }
}
