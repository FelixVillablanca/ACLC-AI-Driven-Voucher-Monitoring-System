<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Your payment was approved</title></head>
<body style="margin:0;padding:24px;background:#F8FAFC;font-family:Inter,Arial,sans-serif;color:#0F172A;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#FFFFFF;border:1px solid #E2E8F0;border-radius:14px;">
    <tr><td style="padding:28px 28px 8px;">
      <div style="display:inline-block;width:32px;height:32px;line-height:32px;text-align:center;border-radius:8px;background:#1E1B4B;color:#FFFFFF;font-size:12px;font-weight:600;">VM</div>
      <h1 style="font-size:22px;line-height:1.3;margin:16px 0 4px;">Your payment was approved</h1>
      <p style="font-size:14px;line-height:1.5;color:#64748B;margin:0;">
        {{ $companyName }} approved a payment to <strong style="color:#0F172A;">{{ $voucher->payee_name }}</strong>.
      </p>
    </td></tr>
    <tr><td style="padding:16px 28px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;">
        <tr><td style="padding:12px 14px 2px;font-size:12px;color:#64748B;">Amount</td></tr>
        <tr><td style="padding:0 14px 10px;font-size:18px;font-weight:700;">PHP {{ number_format((float) $voucher->amount, 2) }}</td></tr>
        <tr><td style="padding:0 14px 4px;font-size:12px;color:#64748B;">Voucher {{ $voucher->voucher_number }} · {{ $method }}</td></tr>
        @if ($voucher->purpose)
          <tr><td style="padding:0 14px 12px;font-size:12px;color:#64748B;">For: {{ $voucher->purpose }}</td></tr>
        @endif
      </table>
    </td></tr>
    @if ($note)
      <tr><td style="padding:0 28px 12px;font-size:14px;line-height:1.5;">
        <span style="color:#64748B;font-size:12px;">A note from {{ $clerk->first_name }} ({{ $companyName }}):</span><br>
        “{{ $note }}”
      </td></tr>
    @endif
    <tr><td style="padding:4px 28px 28px;font-size:12px;line-height:1.5;color:#64748B;">
      The payment details are in the attached PDF. If something looks wrong, reply to {{ $companyName }}’s accounting team.
      <br><br>Sent by {{ $companyName }} through the AI-Driven Voucher Monitoring System.
    </td></tr>
  </table>
</body>
</html>
