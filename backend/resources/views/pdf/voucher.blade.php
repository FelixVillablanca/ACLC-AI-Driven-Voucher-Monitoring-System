<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>{{ $number }}</title>
  <style>
    @page { margin: 28px 34px; }
    body { font-family: DejaVu Sans, Arial, sans-serif; font-size: 10px; color: #0F172A; }
    .muted { color: #64748B; }
    .head { width: 100%; border-bottom: 2px solid #1E1B4B; padding-bottom: 8px; margin-bottom: 12px; }
    .head td { vertical-align: top; }
    h1 { font-size: 16px; margin: 0; }
    .title { font-size: 13px; font-weight: bold; letter-spacing: .06em; text-transform: uppercase; color: #1E1B4B; }
    .pill { display: inline-block; padding: 2px 8px; border-radius: 9px; background: #EEF2FF; color: #4F46E5; font-size: 9px; font-weight: bold; text-transform: uppercase; }
    .grid { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
    .grid td { border: 1px solid #E2E8F0; padding: 6px 8px; width: 25%; vertical-align: top; }
    .label { font-size: 8px; text-transform: uppercase; letter-spacing: .05em; color: #64748B; display: block; margin-bottom: 2px; }
    .lines { width: 100%; border-collapse: collapse; }
    .lines th { background: #F8FAFC; font-size: 8px; text-transform: uppercase; letter-spacing: .05em; color: #64748B; text-align: left; }
    .lines th, .lines td { border-bottom: 1px solid #E2E8F0; padding: 6px 8px; }
    .r, .lines .r { text-align: right; }
    .total td { font-weight: bold; font-size: 12px; border-top: 2px solid #0F172A; border-bottom: none; }
    .words { margin: 8px 0 18px; padding: 8px; background: #F8FAFC; border: 1px solid #E2E8F0; }
    .sign { width: 100%; border-collapse: collapse; margin-top: 26px; }
    .sign td { width: 33%; padding: 0 10px; vertical-align: top; }
    .sign-name { height: 16px; white-space: nowrap; overflow: hidden; }
    .line { border-top: 1px solid #0F172A; padding-top: 4px; margin-top: 22px; }
    .sign-date { height: 12px; }
    .draft { position: fixed; top: 300px; left: 80px; font-size: 90px; color: #DC2626; opacity: .12; transform: rotate(-30deg); }
    .foot { position: fixed; bottom: -10px; left: 0; right: 0; font-size: 8px; color: #64748B; }
  </style>
</head>
<body>
  @if ($v->status === 'draft')<div class="draft">DRAFT</div>@endif
  @if ($v->status === 'cancelled')<div class="draft">CANCELLED</div>@endif
  @if ($v->status === 'rejected')<div class="draft">REJECTED</div>@endif

  <table class="head">
    <tr>
      <td>
        <h1>{{ $company->name ?? '' }}</h1>
        @if (! empty($company->address))<div class="muted">{{ $company->address }}</div>@endif
      </td>
      <td class="r">
        <div class="title">{{ $voucherType ?: 'Disbursement voucher' }}</div>
        <div style="font-size:13px;font-weight:bold;margin-top:2px;">{{ $number }}</div>
        <span class="pill">{{ str_replace('_', ' ', $v->status === 'pending' ? 'with accounting' : ($v->status === 'under_review' ? 'with supervisor' : $v->status)) }}</span>
      </td>
    </tr>
  </table>

  <table class="grid">
    <tr>
      <td colspan="2"><span class="label">Payee</span>{{ $v->payee_name ?: '—' }}@if ($payeeType) <span class="muted">· {{ $payeeType }}</span>@endif</td>
      <td><span class="label">Date</span>{{ ($v->submitted_at ?? $v->created_at)?->format('M j, Y') }}</td>
      <td><span class="label">Due date</span>{{ $v->due_date ? \Illuminate\Support\Carbon::parse($v->due_date)->format('M j, Y') : '—' }}</td>
    </tr>
    <tr>
      <td><span class="label">Category</span>{{ $category ?: '—' }}</td>
      <td><span class="label">Department</span>{{ $department ?: '—' }}</td>
      <td><span class="label">Payment</span>{{ ['cash' => 'Cash', 'bank' => 'Bank transfer', 'cheque' => 'Check'][$v->payment_method] ?? $v->payment_method }}</td>
      <td><span class="label">Reference</span>{{ $v->reference_number ?: '—' }}</td>
    </tr>
    @if ($v->payment_method === 'bank')
    <tr>
      <td colspan="4"><span class="label">Bank details</span>{{ collect([$v->bank_name, $v->bank_account_name, $v->bank_account_number])->filter()->implode(' · ') ?: '—' }}</td>
    </tr>
    @endif
    @if ($v->description || $v->purpose)
    <tr>
      <td colspan="4"><span class="label">Particulars</span>{{ $v->description }}@if ($v->description && $v->purpose)<br>@endif{{ $v->purpose }}</td>
    </tr>
    @endif
  </table>

  <table class="lines">
    <thead><tr><th>Description</th><th class="r">Qty</th><th>Unit</th><th class="r">Unit price</th><th class="r">Amount</th></tr></thead>
    <tbody>
      @forelse ($lines as $l)
        <tr>
          <td>{{ $l->description }}</td>
          <td class="r">{{ rtrim(rtrim($l->quantity, '0'), '.') }}</td>
          <td>{{ $l->unit }}</td>
          <td class="r">₱{{ number_format((float) $l->unit_price, 2) }}</td>
          <td class="r">₱{{ number_format((float) $l->total_price, 2) }}</td>
        </tr>
      @empty
        <tr><td colspan="5" class="muted">No lines.</td></tr>
      @endforelse
      <tr class="total"><td colspan="4" class="r">Total</td><td class="r">₱{{ number_format((float) $v->amount, 2) }}</td></tr>
    </tbody>
  </table>

  <div class="words"><span class="label">Amount in words</span>{{ $words }}</div>

  <table class="sign">
    <tr>
      @foreach ([['Prepared by', $prepared], ['Reviewed by (Accounting)', $reviewed], ['Approved by', $approved]] as [$label, $who])
        <td>
          <div class="sign-name">{{ $who['name'] ?? '' }}</div>
          <div class="line"><strong>{{ $label }}</strong></div>
          <div class="sign-date muted">{{ $who['at'] ?? '' }}</div>
        </td>
      @endforeach
    </tr>
  </table>

  <div class="foot">Printed {{ $printedAt }} from the AI-Driven Voucher Monitoring System. Names in the signature blocks come from the approval history.</div>
</body>
</html>
