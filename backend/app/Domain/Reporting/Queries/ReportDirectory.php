<?php

namespace App\Domain\Reporting\Queries;

use App\Domain\Vouchers\VoucherStatus as S;
use App\Models\Company;
use App\Models\FinancialReport;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * The reports list (Framer ARxG8Aa6F) of the company in X-Company-ID, newest first, 10 a page.
 * Filters: type (monthly | quarterly | custom), department (id, or "all" = company-wide only), search (title).
 * stats(): reports this year by type, last month's approved spend vs the month before, the next automatic report.
 */
class ReportDirectory
{
    public const PER_PAGE = 10;

    public function __construct(private Company $company) {}

    public function list(?string $type, ?string $department, ?string $search): LengthAwarePaginator
    {
        return FinancialReport::query()->where('company_id', $this->company->id)
            ->with(['department:id,name', 'generator:id,first_name,last_name'])
            ->when($type, fn ($q) => $q->where('report_type', $type))
            ->when($department === 'all', fn ($q) => $q->whereNull('department_id'))
            ->when($department && $department !== 'all', fn ($q) => $q->where('department_id', (int) $department))
            ->when($search, fn ($q) => $q->where('title', 'like', '%'.addcslashes((string) $search, '%_\\').'%'))
            ->orderByDesc('generated_at')->orderByDesc('id')
            ->paginate(self::PER_PAGE);
    }

    public function stats(): array
    {
        $year = Carbon::now()->year;
        $byType = FinancialReport::query()->where('company_id', $this->company->id)->whereYear('generated_at', $year)
            ->groupBy('report_type')->selectRaw('report_type, COUNT(*) as n')->pluck('n', 'report_type');
        $lastMonth = Carbon::now()->subMonthNoOverflow()->startOfMonth();
        $spend = fn (Carbon $m) => (string) DB::table('vouchers')->where('company_id', $this->company->id)->where('status', S::Approved->value)
            ->whereBetween('approved_at', [$m->copy()->startOfMonth(), $m->copy()->endOfMonth()])->selectRaw('COALESCE(SUM(amount), 0) as t')->value('t');
        $last = $spend($lastMonth);
        $before = $spend($lastMonth->copy()->subMonthNoOverflow());
        $next = Carbon::now()->addMonthNoOverflow()->startOfMonth();

        return [
            'this_year' => [
                'total' => (int) $byType->sum(),
                'monthly' => (int) ($byType['monthly'] ?? 0),
                'quarterly' => (int) ($byType['quarterly'] ?? 0),
                'custom' => (int) ($byType['custom'] ?? 0),
            ],
            'last_month' => [
                'label' => $lastMonth->format('F'),
                'previous_label' => $lastMonth->copy()->subMonthNoOverflow()->format('F'),
                'spend' => $last,
                'change_pct' => (float) $before > 0 ? (int) round(((float) $last - (float) $before) / (float) $before * 100) : null,
            ],
            'next_scheduled' => [
                'date' => $next->toDateString(),
                'label' => $next->copy()->subMonthNoOverflow()->format('F').' monthly report',
            ],
        ];
    }

    /** One report as the list / page shows it. */
    public static function present(FinancialReport $r, bool $full = false): array
    {
        $data = [
            'id' => $r->id,
            'title' => $r->title,
            'type' => $r->report_type,
            'department' => $r->department ? ['id' => $r->department->id, 'name' => $r->department->name] : null,
            'period_start' => $r->period_start?->toDateString(),
            'period_end' => $r->period_end?->toDateString(),
            'vouchers' => (int) $r->approved_count,
            'total' => (string) $r->total_amount,
            'summary_status' => $r->summary_status,
            'generated_at' => $r->generated_at?->toIso8601String(),
            'generated_by' => $r->is_scheduled ? 'Automatic' : ($r->generator ? trim($r->generator->first_name.' '.$r->generator->last_name) : null),
            'is_scheduled' => (bool) $r->is_scheduled,
        ];
        if ($full) {
            $data += [
                'figures' => $r->figures,
                'includes' => $r->includes,
                'summary' => $r->summary_status === 'ready' ? array_values(array_filter(explode("\n\n", (string) $r->ai_summary))) : null,
                'highlights' => $r->summary_highlights ?? [],
                'summary_model' => $r->summary_model,
                'summary_error' => in_array($r->summary_status, ['failed', 'paused'], true) ? $r->summary_error : null,
                'summary_generated_at' => $r->summary_generated_at?->toIso8601String(),
            ];
        }

        return $data;
    }
}
