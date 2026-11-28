<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Your Admin account was removed</title></head>
<body style="margin:0;padding:24px;background:#F8FAFC;font-family:Inter,Arial,sans-serif;color:#0F172A;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#FFFFFF;border:1px solid #E2E8F0;border-radius:14px;">
    <tr><td style="padding:28px 28px 8px;">
      <div style="display:inline-block;width:32px;height:32px;line-height:32px;text-align:center;border-radius:8px;background:#1E1B4B;color:#FFFFFF;font-size:12px;font-weight:600;">VM</div>
      <h1 style="font-size:22px;line-height:1.3;margin:16px 0 4px;">Hi {{ $firstName }}, your Admin account was removed</h1>
      <p style="font-size:14px;line-height:1.5;color:#64748B;margin:0;">
        Your Admin account <strong style="color:#0F172A;">{{ $workEmail }}</strong> in the AI-Driven Voucher Monitoring System
        wasn’t given a company within {{ $graceHours }} hours, so it was
        {{ $deleted ? 'deleted' : 'deactivated' }} automatically.
      </p>
    </td></tr>
    <tr><td style="padding:16px 28px 28px;font-size:12px;line-height:1.5;color:#64748B;">
      @if ($deleted)
        Any set-password link you received no longer works. If you still need an account, ask your Super Admin to create a new one.
      @else
        You can’t sign in with it any more. If you still need it, ask your Super Admin to give it a company and reactivate it.
      @endif
      <br><br>You received this email because this address was saved as your personal email for that account.
    </td></tr>
  </table>
</body>
</html>
