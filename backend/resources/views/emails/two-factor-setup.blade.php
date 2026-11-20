<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Set up two-step sign-in</title></head>
<body style="margin:0;padding:24px;background:#F8FAFC;font-family:Inter,Arial,sans-serif;color:#0F172A;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#FFFFFF;border:1px solid #E2E8F0;border-radius:14px;">
    <tr><td style="padding:28px 28px 8px;">
      <div style="display:inline-block;width:32px;height:32px;line-height:32px;text-align:center;border-radius:8px;background:#1E1B4B;color:#FFFFFF;font-size:12px;font-weight:600;">VM</div>
      <h1 style="font-size:22px;line-height:1.3;margin:16px 0 4px;">Hi {{ $user->first_name }}, two-step sign-in is now required</h1>
      <p style="font-size:14px;line-height:1.5;color:#64748B;margin:0;">
        To protect your account, a Super Admin turned on two-step sign-in for
        <strong style="color:#0F172A;">{{ $user->email }}</strong>. After your password, you'll also type a 6-digit code from an app on your phone.
      </p>
    </td></tr>
    <tr><td style="padding:16px 28px 4px;font-size:14px;line-height:1.6;">
      <strong>How to set it up (about 2 minutes)</strong>
      <ol style="margin:8px 0 0;padding-left:20px;color:#334155;">
        <li>Install an authenticator app on your phone, for example Google Authenticator or Microsoft Authenticator.</li>
        <li>Sign in as usual. After your password you'll see a QR code.</li>
        <li>In the app, tap “+” and scan the QR code.</li>
        <li>Type the 6-digit code the app shows. Save the backup codes we give you somewhere safe.</li>
      </ol>
    </td></tr>
    <tr><td style="padding:16px 28px 4px;">
      <a href="{{ $signInUrl }}" style="display:inline-block;background:#4F46E5;color:#FFFFFF;text-decoration:none;font-size:14px;font-weight:600;padding:11px 18px;border-radius:8px;">Sign in to set it up</a>
    </td></tr>
    <tr><td style="padding:12px 28px 28px;font-size:12px;line-height:1.5;color:#64748B;">
      You have {{ $setupDays }} {{ $setupDays === 1 ? 'day' : 'days' }} to do it. After that, signing in waits until it's set up.
      Once it's on, you can't turn it off yourself.
    </td></tr>
  </table>
</body>
</html>
