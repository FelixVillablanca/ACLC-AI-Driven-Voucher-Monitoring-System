<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Company list</title>
  <style>
    body { font-family: DejaVu Sans, Arial, sans-serif; font-size: 10px; color: #0F172A; }
    h1 { font-size: 16px; margin: 0 0 2px; }
    .meta { color: #64748B; margin: 0 0 12px; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #F8FAFC; text-align: left; font-size: 9px; text-transform: uppercase; letter-spacing: .04em; color: #64748B; }
    th, td { border-bottom: 1px solid #E2E8F0; padding: 6px 8px; vertical-align: top; }
    .foot { margin-top: 10px; color: #64748B; font-size: 9px; }
  </style>
</head>
<body>
  <h1>Company list</h1>
  <p class="meta">AI-Driven Voucher Monitoring System · {{ count($rows) }} {{ count($rows) === 1 ? 'company' : 'companies' }} · exported {{ $at }} by {{ $by }}</p>
  <table>
    <thead><tr>@foreach ($headers as $h)<th>{{ $h }}</th>@endforeach</tr></thead>
    <tbody>
      @foreach ($rows as $row)
        <tr>@foreach ($row as $cell)<td>{{ $cell }}</td>@endforeach</tr>
      @endforeach
    </tbody>
  </table>
  <p class="foot">Counts only: no amounts or vouchers. This export is recorded in the audit log.</p>
</body>
</html>
