<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Sign-in attempts on your account</title></head>
<body style="margin:0;padding:24px;background:#F8FAFC;font-family:Inter,Arial,sans-serif;color:#0F172A;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#FFFFFF;border:1px solid #E2E8F0;border-radius:14px;">
    <tr><td style="padding:28px 28px 8px;">
      <div style="display:inline-block;width:32px;height:32px;line-height:32px;text-align:center;border-radius:8px;background:#1E1B4B;color:#FFFFFF;font-size:12px;font-weight:600;">VM</div>
      <h1 style="font-size:22px;line-height:1.3;margin:16px 0 4px;">Hi {{ $user->first_name }}, someone tried to sign in to your account</h1>
      <p style="font-size:14px;line-height:1.5;color:#64748B;margin:0;">
        Several sign-ins to <strong style="color:#0F172A;">{{ $user->email }}</strong> failed today from the address
        <strong style="color:#0F172A;">{{ $ip }}</strong>. The platform owner has blocked that address, so it can't try again.
      </p>
    </td></tr>
    <tr><td style="padding:16px 28px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFFBEB;border-radius:10px;">
        <tr><td style="padding:12px 14px;font-size:14px;line-height:1.5;">
          <strong>Was it you?</strong> Then there's nothing to do. If it wasn't, your password still kept them out,
          but we recommend changing it and turning on two-step sign-in if you haven't yet.
        </td></tr>
      </table>
    </td></tr>
    <tr><td style="padding:20px 28px 28px;font-size:12px;line-height:1.5;color:#64748B;">
      AI-Driven Voucher Monitoring System · You get this email because a Super Admin chose to tell the account owners.
      We never ask for your password by email.
    </td></tr>
  </table>
</body>
</html>
