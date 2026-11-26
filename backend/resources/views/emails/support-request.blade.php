<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Support request</title></head>
<body style="margin:0;padding:24px;background:#F8FAFC;font-family:Inter,Arial,sans-serif;color:#0F172A;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#FFFFFF;border:1px solid #E2E8F0;border-radius:14px;">
    <tr><td style="padding:28px 28px 8px;">
      <div style="display:inline-block;width:32px;height:32px;line-height:32px;text-align:center;border-radius:8px;background:#1E1B4B;color:#FFFFFF;font-size:12px;font-weight:600;">VM</div>
      <h1 style="font-size:22px;line-height:1.3;margin:16px 0 4px;">Hi {{ $admin->first_name }}, {{ $sender->full_name }} needs help</h1>
      <p style="font-size:14px;line-height:1.5;color:#64748B;margin:0;">
        A message sent from Help &amp; guides in {{ $company->name }}. Reply to this email to answer them.
      </p>
    </td></tr>
    <tr><td style="padding:16px 28px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F7F8FF;border-radius:10px;">
        <tr><td style="padding:12px 14px 2px;font-size:12px;color:#64748B;">Topic</td></tr>
        <tr><td style="padding:0 14px 8px;font-size:14px;font-weight:600;">{{ $topic }}</td></tr>
        @if ($voucherNumber)
        <tr><td style="padding:4px 14px 2px;font-size:12px;color:#64748B;">Related voucher</td></tr>
        <tr><td style="padding:0 14px 8px;font-size:14px;">{{ $voucherNumber }}</td></tr>
        @endif
        <tr><td style="padding:4px 14px 2px;font-size:12px;color:#64748B;">Message</td></tr>
        <tr><td style="padding:0 14px 12px;font-size:14px;line-height:1.5;white-space:pre-wrap;">{{ $body }}</td></tr>
      </table>
    </td></tr>
    <tr><td style="padding:20px 28px 28px;font-size:12px;line-height:1.5;color:#64748B;">
      From {{ $sender->full_name }} ({{ $sender->email }}){{ $screenshot ? ' · screenshot attached' : '' }}.
    </td></tr>
  </table>
</body>
</html>
