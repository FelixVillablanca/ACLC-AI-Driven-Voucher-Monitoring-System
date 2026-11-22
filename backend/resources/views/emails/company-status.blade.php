<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>{{ $company->name }}</title></head>
<body style="margin:0;padding:24px;background:#F8FAFC;font-family:Inter,Arial,sans-serif;color:#0F172A;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#FFFFFF;border:1px solid #E2E8F0;border-radius:14px;">
    <tr><td style="padding:28px 28px 8px;">
      <div style="display:inline-block;width:32px;height:32px;line-height:32px;text-align:center;border-radius:8px;background:#1E1B4B;color:#FFFFFF;font-size:12px;font-weight:600;">VM</div>
      @if ($what === 'suspended')
      <h1 style="font-size:22px;line-height:1.3;margin:16px 0 4px;">Hi {{ $admin->first_name }}, {{ $company->name }} has been suspended</h1>
      <p style="font-size:14px;line-height:1.5;color:#64748B;margin:0;">
        The platform owner of the AI-Driven Voucher Monitoring System suspended your company's account.
        Until it is reactivated, nobody in {{ $company->name }} can sign in. All your data is kept: nothing was deleted.
      </p>
      @else
      <h1 style="font-size:22px;line-height:1.3;margin:16px 0 4px;">Hi {{ $admin->first_name }}, {{ $company->name }} is active again</h1>
      <p style="font-size:14px;line-height:1.5;color:#64748B;margin:0;">
        The platform owner reactivated your company's account. You and everyone in {{ $company->name }} can sign in again,
        and everything continues where it stopped.
      </p>
      @endif
    </td></tr>
    @if ($reason)
    <tr><td style="padding:16px 28px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:{{ $what === 'suspended' ? '#FFFBEB' : '#ECFDF5' }};border-radius:10px;">
        <tr><td style="padding:12px 14px 2px;font-size:12px;color:#64748B;">{{ $what === 'suspended' ? 'Reason' : 'Note' }}</td></tr>
        <tr><td style="padding:0 14px 12px;font-size:14px;">{{ $reason }}</td></tr>
      </table>
    </td></tr>
    @endif
    <tr><td style="padding:20px 28px 28px;font-size:12px;line-height:1.5;color:#64748B;">
      If you have questions, contact the person who manages your platform account.
    </td></tr>
  </table>
</body>
</html>
