<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>{{ $v->voucher_number }} · {{ $title }}</title>
  <style>
    @page { margin: 28px 34px; }
    body { font-family: DejaVu Sans, Arial, sans-serif; font-size: 10px; color: #0F172A; }
    .muted { color: #64748B; }
    .head { width: 100%; border-bottom: 2px solid #1E1B4B; padding-bottom: 8px; margin-bottom: 14px; }
    .head td { vertical-align: top; }
    h1 { font-size: 16px; margin: 0; }
    .title { font-size: 13px; font-weight: bold; letter-spacing: .06em; text-transform: uppercase; color: #1E1B4B; }
    .pill { display: inline-block; padding: 2px 8px; border-radius: 9px; background: #ECFDF5; color: #047857; font-size: 9px; font-weight: bold; text-transform: uppercase; }
    .grid { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
    .grid td { border: 1px solid #E2E8F0; padding: 7px 9px; vertical-align: top; }
    .label { font-size: 8px; text-transform: uppercase; letter-spacing: .05em; color: #64748B; display: block; margin-bottom: 2px; }
    .amount { font-size: 18px; font-weight: bold; }
    .words { margin: 0 0 14px; padding: 8px 9px; background: #F8FAFC; border: 1px solid #E2E8F0; }
    .box { border: 1px solid #E2E8F0; border-radius: 6px; padding: 10px 12px; margin-bottom: 14px; }
    .box h2 { font-size: 10px; text-transform: uppercase; letter-spacing: .05em; color: #1E1B4B; margin: 0 0 8px; }
    .fill { width: 100%; border-collapse: collapse; }
    .fill td { padding: 9px 6px 3px 0; vertical-align: bottom; }
    .blank { border-bottom: 1px solid #0F172A; height: 14px; }
    .sign { width: 100%; border-collapse: collapse; margin-top: 18px; }
    .sign td { width: 33%; padding: 0 10px; vertical-align: top; }
    .line { border-top: 1px solid #0F172A; padding-top: 4px; margin-top: 22px; }
    .foot { position: fixed; bottom: -10px; left: 0; right: 0; font-size: 8px; color: #64748B; }
  </style>
</head>
<body>
  <table class="head">
    <tr>
      <td>
        <h1>{{ $company->name ?? '' }}</h1>
        @if (! empty($company->address))<div class="muted">{{ $company->address }}</div>@endif
        @if (! empty($company->tin_number))<div class="muted">TIN {{ $company->tin_number }}</div>@endif
      </td>
      <td style="text-align:right;">
        <div class="title">{{ $title }}</div>
        <div style="font-size:13px;font-weight:bold;margin-top:2px;">{{ $v->voucher_number }}</div>
        <span class="pill">Approved{{ $approvedAt ? ' · '.$approvedAt : '' }}</span>
      </td>
    </tr>
  </table>

  <table class="grid">
    <tr>
      <td style="width:50%;"><span class="label">Pay to</span>{{ $v->payee_name ?: '—' }}</td>
      <td style="width:25%;"><span class="label">Payment method</span>{{ ['cash' => 'Cash', 'bank' => 'Bank transfer', 'cheque' => 'Cheque'][$method] ?? $method }}</td>
      <td style="width:25%;"><span class="label">Amount</span><span class="amount">PHP {{ number_format((float) $v->amount, 2) }}</span></td>
    </tr>
    <tr>
      <td colspan="2"><span class="label">For</span>{{ $v->purpose ?: ($v->description ?: '—') }}</td>
      <td><span class="label">Category</span>{{ $category ?: '—' }}</td>
    </tr>
  </table>

  <div class="words"><span class="label">Amount in words</span>{{ $words }}</div>

  @if ($method === 'bank')
    <div class="box">
      <h2>Bank transfer details</h2>
      <table class="grid" style="margin-bottom:6px;">
        <tr>
          <td style="width:34%;"><span class="label">Bank</span>{{ $v->bank_name ?: '—' }}</td>
          <td style="width:33%;"><span class="label">Account name</span>{{ $v->bank_account_name ?: '—' }}</td>
          <td style="width:33%;"><span class="label">Account number</span>{{ $account ?: '—' }}</td>
        </tr>
      </table>
      <table class="fill">
        <tr>
          <td style="width:22%;" class="muted">Transfer reference no.</td><td style="width:28%;"><div class="blank"></div></td>
          <td style="width:18%;padding-left:12px;" class="muted">Date transferred</td><td style="width:32%;"><div class="blank"></div></td>
        </tr>
      </table>
    </div>
  @elseif ($method === 'cheque')
    <div class="box">
      @if ($cheque)
        <h2>Cheque details</h2>
        <table class="fill">
          <tr>
            <td style="width:14%;" class="muted">Cheque no.</td><td style="width:22%;"><b>{{ $cheque->cheque_number }}</b></td>
            <td style="width:14%;padding-left:12px;" class="muted">Cheque date</td><td style="width:18%;">{{ $cheque->cheque_date->format('M j, Y') }}</td>
            <td style="width:8%;padding-left:12px;" class="muted">Bank</td><td style="width:24%;">{{ $cheque->bank_name }}</td>
          </tr>
        </table>
      @else
        <h2>Cheque details (fill in when the cheque is written)</h2>
        <table class="fill">
          <tr>
            <td style="width:14%;" class="muted">Cheque no.</td><td style="width:22%;"><div class="blank"></div></td>
            <td style="width:14%;padding-left:12px;" class="muted">Cheque date</td><td style="width:18%;"><div class="blank"></div></td>
            <td style="width:8%;padding-left:12px;" class="muted">Bank</td><td style="width:24%;"><div class="blank"></div></td>
          </tr>
        </table>
      @endif
    </div>
  @endif

  @if ($method === 'cash' || $method === 'cheque')
    <div class="box">
      <h2>Received by the payee</h2>
      <p style="margin:0 0 6px;">
        Received from {{ $company->name ?? 'the company' }} the sum of <b>{{ $words }}</b> (PHP {{ number_format((float) $v->amount, 2) }})
        {{ $method === 'cash' ? 'in cash' : 'by cheque' }}, in payment of the above.
      </p>
      <table class="fill">
        <tr>
          <td style="width:12%;" class="muted">Name</td><td style="width:38%;"><div class="blank"></div></td>
          <td style="width:12%;padding-left:12px;" class="muted">Signature</td><td style="width:22%;"><div class="blank"></div></td>
          <td style="width:6%;padding-left:12px;" class="muted">Date</td><td style="width:10%;"><div class="blank"></div></td>
        </tr>
      </table>
    </div>
  @endif

  <table class="sign">
    <tr>
      <td>
        <div style="height:16px;">{{ $prepared ?? '' }}</div>
        <div class="line"><span class="label">Prepared by</span></div>
      </td>
      <td>
        <div style="height:16px;">{{ $reviewed['name'] ?? '' }}</div>
        <div class="line"><span class="label">Reviewed by (Accounting){{ isset($reviewed['at']) ? ' · '.$reviewed['at'] : '' }}</span></div>
      </td>
      <td>
        <div style="height:16px;">{{ $approved['name'] ?? '' }}</div>
        <div class="line"><span class="label">Approved by (Supervisor){{ isset($approved['at']) ? ' · '.$approved['at'] : '' }}</span></div>
      </td>
    </tr>
  </table>

  <div class="foot">
    {{ $v->voucher_number }} · {{ $title }} · Generated {{ $printedAt }} by the AI-Driven Voucher Monitoring System{{ $forPayee ? ' · Payee copy' : '' }}
  </div>
</body>
</html>
