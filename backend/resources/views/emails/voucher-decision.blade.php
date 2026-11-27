<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>{{ $voucher->voucher_number }}</title></head>
<body style="margin:0;padding:24px;background:#F8FAFC;font-family:Inter,Arial,sans-serif;color:#0F172A;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#FFFFFF;border:1px solid #E2E8F0;border-radius:14px;">
    <tr><td style="padding:28px 28px 8px;">
      <div style="display:inline-block;width:32px;height:32px;line-height:32px;text-align:center;border-radius:8px;background:#1E1B4B;color:#FFFFFF;font-size:12px;font-weight:600;">VM</div>
      @if ($decision === 'returned')
      <h1 style="font-size:22px;line-height:1.3;margin:16px 0 4px;">Hi {{ $clerk->first_name }}, {{ $voucher->voucher_number }} needs changes</h1>
      <p style="font-size:14px;line-height:1.5;color:#64748B;margin:0;">
        {{ $reviewer->full_name }} (Accounting) sent it back to you in {{ $company->name }}. Fix it and resubmit: it keeps its number.
      </p>
      @else
      <h1 style="font-size:22px;line-height:1.3;margin:16px 0 4px;">Hi {{ $clerk->first_name }}, {{ $voucher->voucher_number }} was rejected</h1>
      <p style="font-size:14px;line-height:1.5;color:#64748B;margin:0;">
        {{ $reviewer->full_name }} (Accounting) rejected it in {{ $company->name }}. A rejected voucher is closed and can't be resubmitted.
      </p>
      @endif
    </td></tr>
    <tr><td style="padding:16px 28px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:{{ $decision === 'returned' ? '#FFFBEB' : '#FEF2F2' }};border-radius:10px;">
        <tr><td style="padding:12px 14px 2px;font-size:12px;color:#64748B;">Voucher</td></tr>
        <tr><td style="padding:0 14px 8px;font-size:14px;">{{ $voucher->voucher_number }} · {{ $voucher->payee_name }} · ₱{{ number_format((float) $voucher->amount, 2) }}</td></tr>
        @if ($needsChanges)
        <tr><td style="padding:4px 14px 2px;font-size:12px;color:#64748B;">Needs changes</td></tr>
        <tr><td style="padding:0 14px 8px;font-size:14px;font-weight:600;">{{ implode(', ', $needsChanges) }}</td></tr>
        @endif
        @if ($reason)
        <tr><td style="padding:4px 14px 2px;font-size:12px;color:#64748B;">Reason</td></tr>
        <tr><td style="padding:0 14px 8px;font-size:14px;font-weight:600;">{{ $reason }}</td></tr>
        @endif
        <tr><td style="padding:4px 14px 2px;font-size:12px;color:#64748B;">Remarks</td></tr>
        <tr><td style="padding:0 14px 12px;font-size:14px;line-height:1.5;white-space:pre-wrap;">{{ $remarks }}</td></tr>
      </table>
    </td></tr>
    @if ($link)
    <tr><td style="padding:20px 28px 0;">
      <a href="{{ $link }}" style="display:inline-block;padding:10px 16px;border-radius:8px;background:#4F46E5;color:#FFFFFF;font-size:14px;font-weight:600;text-decoration:none;">Open the voucher</a>
    </td></tr>
    @endif
    <tr><td style="padding:20px 28px 28px;font-size:12px;line-height:1.5;color:#64748B;">
      You also have a notification in ADVMS.
    </td></tr>
  </table>
</body>
</html>
