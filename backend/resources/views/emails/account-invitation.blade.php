<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Set your password</title></head>
<body style="margin:0;padding:24px;background:#F8FAFC;font-family:Inter,Arial,sans-serif;color:#0F172A;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#FFFFFF;border:1px solid #E2E8F0;border-radius:14px;">
    <tr><td style="padding:28px 28px 8px;">
      <div style="display:inline-block;width:32px;height:32px;line-height:32px;text-align:center;border-radius:8px;background:#1E1B4B;color:#FFFFFF;font-size:12px;font-weight:600;">VM</div>
      <h1 style="font-size:22px;line-height:1.3;margin:16px 0 4px;">Hi {{ $user->first_name }}, your Admin account is ready</h1>
      <p style="font-size:14px;line-height:1.5;color:#64748B;margin:0;">
        @if ($companyName)
        You were made the System Administrator for <strong style="color:#0F172A;">{{ $companyName }}</strong>
        in the AI-Driven Voucher Monitoring System.
        @else
        You were given a System Administrator account in the AI-Driven Voucher Monitoring System.
        You don’t have a company yet: a Super Admin will assign you one, and you’ll get a notice when they do.
        If no company is given within 24 hours, this account is removed automatically.
        @endif
      </p>
    </td></tr>
    <tr><td style="padding:16px 28px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;">
        <tr><td style="padding:12px 14px;font-size:12px;color:#64748B;">Your sign-in email</td></tr>
        <tr><td style="padding:0 14px 12px;font-size:14px;font-weight:600;">{{ $user->email }}</td></tr>
        <tr><td style="padding:0 14px 12px;font-size:12px;color:#64748B;">Employee ID: {{ $user->employee_id }}</td></tr>
      </table>
    </td></tr>
    <tr><td style="padding:8px 28px 4px;">
      <a href="{{ $link }}" style="display:inline-block;background:#4F46E5;color:#FFFFFF;text-decoration:none;font-size:14px;font-weight:600;padding:11px 18px;border-radius:8px;">Set your password</a>
    </td></tr>
    <tr><td style="padding:12px 28px 28px;font-size:12px;line-height:1.5;color:#64748B;">
      This link works once and expires in {{ $expiresInHours }} hours. If it expires, ask your Super Admin to send a new one.<br>
      If you weren't expecting this email, you can ignore it; nothing happens until the link is used.<br><br>
      If the button doesn't work, copy this address into your browser:<br>
      <span style="word-break:break-all;color:#4F46E5;">{{ $link }}</span>
    </td></tr>
  </table>
</body>
</html>
