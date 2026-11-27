@php
  /** Financial report PDF (Framer UmSNc_71u "Download PDF", 2026-11-27). $report = ReportDirectory::present(full), $company. */
  $f = $report['figures'] ?? [];
  $peso = fn ($v) => 'PHP '.number_format((float) $v, 2);
  $chg = fn ($p) => $p === null ? '—' : (($p >= 0 ? '+' : '').$p.'%');
@endphp
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>{{ $report['title'] }}</title>
  <style>
    @page { margin: 28px 34px; }
    body { font-family: DejaVu Sans, Arial, sans-serif; font-size: 10px; color: #0F172A; }
    .muted { color: #64748B; }
    .head { width: 100%; border-bottom: 2px solid #1E1B4B; padding-bottom: 8px; margin-bottom: 12px; }
    h1 { font-size: 15px; margin: 0 0 2px; }
    .grid { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
    .grid td { border: 1px solid #E2E8F0; padding: 6px 8px; width: 25%; vertical-align: top; }
    .label { font-size: 8px; text-transform: uppercase; letter-spacing: .05em; color: #64748B; display: block; margin-bottom: 2px; }
    .big { font-size: 13px; font-weight: bold; }
    .summary { border: 1px solid #C7D2FE; background: #F7F8FF; padding: 8px 10px; margin-bottom: 12px; }
    .summary p { margin: 0 0 6px; line-height: 1.45; }
    h2 { font-size: 11px; margin: 14px 0 6px; color: #1E1B4B; }
    .t { width: 100%; border-collapse: collapse; }
    .t th { background: #F8FAFC; font-size: 8px; text-transform: uppercase; letter-spacing: .05em; color: #64748B; text-align: left; }
    .t th, .t td { border-bottom: 1px solid #E2E8F0; padding: 5px 8px; }
    .r { text-align: right; }
    .foot { position: fixed; bottom: -10px; left: 0; right: 0; font-size: 8px; color: #64748B; }
  </style>
</head>
<body>
  <div class="head">
    <h1>{{ $report['title'] }}</h1>
    <div class="muted">
      {{ $company->name }} · {{ $report['department']['name'] ?? 'All departments' }} ·
      {{ \Illuminate\Support\Carbon::parse($report['period_start'])->format('M j, Y') }} – {{ \Illuminate\Support\Carbon::parse($report['period_end'])->format('M j, Y') }} ·
      generated {{ \Illuminate\Support\Carbon::parse($report['generated_at'])->format('M j, Y') }}{{ $report['generated_by'] ? ' by '.$report['generated_by'] : '' }}
    </div>
  </div>

  <table class="grid">
    <tr>
      <td><span class="label">Total spend</span><span class="big">{{ $peso($f['total_spend'] ?? 0) }}</span><br><span class="muted">{{ $chg($f['change_pct'] ?? null) }} vs {{ $f['period']['previous_label'] ?? 'previous period' }}</span></td>
      <td><span class="label">Vouchers approved</span><span class="big">{{ $f['approved'] ?? 0 }}</span><br><span class="muted">{{ $f['rejected'] ?? 0 }} rejected · {{ $f['returned'] ?? 0 }} returned</span></td>
      <td><span class="label">Flagged</span><span class="big">{{ $f['flagged'] ?? 0 }}</span><br><span class="muted">{{ $f['flagged_open'] ?? 0 }} still open</span></td>
      <td><span class="label">Budget used ({{ $f['budget']['label'] ?? 'FY' }})</span><span class="big">{{ isset($f['budget']) ? $f['budget']['used_pct'].'%' : '—' }}</span><br><span class="muted">{{ isset($f['budget']) ? $peso($f['budget']['used']).' of '.$peso($f['budget']['total']) : 'No budget set' }}</span></td>
    </tr>
  </table>

  @if ($report['summary'])
    <div class="summary">
      <span class="label">AI summary ({{ $report['summary_model'] }}) · check the figures before sharing</span>
      @foreach ($report['summary'] as $p)<p>{{ $p }}</p>@endforeach
    </div>
  @endif

  @if (! empty($f['departments']))
    <h2>Spend by department</h2>
    <table class="t"><tr><th>Department</th><th class="r">Vouchers</th><th class="r">Amount</th><th class="r">vs previous</th></tr>
      @foreach ($f['departments'] as $d)<tr><td>{{ $d['name'] }}</td><td class="r">{{ $d['vouchers'] }}</td><td class="r">{{ $peso($d['amount']) }}</td><td class="r">{{ $chg($d['change_pct']) }}</td></tr>@endforeach
    </table>
  @endif

  @if (! empty($f['categories']))
    <h2>Top categories</h2>
    <table class="t"><tr><th>Category</th><th class="r">Vouchers</th><th class="r">Amount</th><th class="r">vs previous</th></tr>
      @foreach ($f['categories'] as $c)<tr><td>{{ $c['name'] }}</td><td class="r">{{ $c['vouchers'] }}</td><td class="r">{{ $peso($c['amount']) }}</td><td class="r">{{ $chg($c['change_pct']) }}</td></tr>@endforeach
    </table>
  @endif

  @if (! empty($f['flagged_list']))
    <h2>Flagged vouchers</h2>
    <table class="t"><tr><th>Voucher</th><th class="r">Amount</th><th>Status</th><th>Finding</th></tr>
      @foreach ($f['flagged_list'] as $v)<tr><td>{{ $v['voucher_number'] }}</td><td class="r">{{ $peso($v['amount']) }}</td><td>{{ str_replace('_', ' ', $v['status']) }}</td><td>{{ str_replace('_', ' ', $v['finding'] ?? '—') }}</td></tr>@endforeach
    </table>
  @endif

  @if (! empty($f['forecast']))
    <h2>Forecast for {{ $f['forecast']['month'] }}</h2>
    <p>{{ $peso($f['forecast']['predicted']) }} (likely {{ $peso($f['forecast']['lower']) }} – {{ $peso($f['forecast']['upper']) }}), straight-line trend of approved spending.</p>
  @endif

  <div class="foot">Spend = vouchers with their final approval in the period. Figures frozen when the report was generated.</div>
</body>
</html>
