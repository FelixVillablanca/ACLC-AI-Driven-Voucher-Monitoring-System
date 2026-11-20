<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Choose a new password</title></head>
<body style="margin:0;padding:24px;background:#F8FAFC;font-family:Inter,Arial,sans-serif;color:#0F172A;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#FFFFFF;border:1px solid #E2E8F0;border-radius:14px;">
    <tr><td style="padding:28px 28px 8px;">
      <div style="display:inline-block;width:32px;height:32px;line-height:32px;text-align:center;border-radius:8px;background:#1E1B4B;color:#FFFFFF;font-size:12px;font-weight:600;">VM</div>
      <h1 style="font-size:22px;line-height:1.3;margin:16px 0 4px;">Hi {{ $user->first_name }}, please choose a new password</h1>
      <p style="font-size:14px;line-height:1.5;color:#64748B;margin:0;">
        To keep your account safe, a Super Admin of the AI-Driven Voucher Monitoring System reset your password
        and signed you out on all devices. Your old password no longer works.
      </p>
    </td></tr>
    <tr><td style="padding:16px 28px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;">
        <tr><td style="padding:12px 14px;font-size:12px;color:#64748B;">Your sign-in email</td></tr>
        <tr><td style="padding:0 14px 12px;font-size:14px;font-weight:600;">{{ $user->email }}</td></tr>
      </table>
    </td></tr>
    <tr><td style="padding:8px 28px 4px;">
      <a href="{{ $link }}" style="display:inline-block;background:#4F46E5;color:#FFFFFF;text-decoration:none;font-size:14px;font-weight:600;padding:11px 18px;border-radius:8px;">Choose a new password</a>
    </td></tr>
    <tr><td style="padding:12px 28px 28px;font-size:12px;line-height:1.5;color:#64748B;">
      This link works once and expires in {{ $expiresInMinutes }} minutes. If it expires, ask your Super Admin to send a new one.<br>
      If you didn't try to sign in recently, someone else may know your old password. Choose one you don't use anywhere else.<br><br>
      If the button doesn't work, copy this address into your browser:<br>
      <span style="word-break:break-all;color:#4F46E5;">{{ $link }}</span>
    </td></tr>
  </table>
</body>
</html>
