<?php

namespace App\Domain\Vouchers\Actions;

use App\Domain\Audit\AuditTrail;
use App\Domain\Vouchers\Support\VoucherMoney;
use App\Domain\Vouchers\Support\VoucherNumber;
use App\Domain\Vouchers\VoucherStatus;
use App\Exceptions\ApiException;
use App\Models\Company;
use App\Models\User;
use App\Models\Voucher;
use Illuminate\Support\Facades\DB;

/**
 * Create a draft, or save changes to a draft / returned voucher (Phase 3, 2026-11-22).
 * One transaction: the voucher row, its line items (replaced as a whole), the total (added up HERE,
 * never taken from the browser) and one audit row.
 * Only the clerk who made it may change it, and only while it's a draft or returned (409 otherwise).
 * Editing sends the `updated_at` the form opened with: 409 VOUCHER_CHANGED if it changed meanwhile.
 */
class SaveVoucherDraft
{
    private const FIELDS = [
        'category_id', 'payment_method', 'voucher_type_id', 'payee_type_id', 'department_id', 'payee_name', 'payee_email', 'description',
        'purpose', 'reference_number', 'due_date', 'priority', 'bank_name', 'bank_account_number', 'bank_account_name',
    ];

    public function create(array $data, User $clerk, Company $company, ?string $ip = null): Voucher
    {
        return DB::transaction(function () use ($data, $clerk, $company, $ip) {
            $voucher = new Voucher;
            $voucher->forceFill([
                ...$this->fields($data, $company->id),
                'voucher_number' => VoucherNumber::draft(),
                'company_id' => $company->id,
                'department_id' => $data['department_id'] ?? $clerk->department_id,
                'created_by' => $clerk->id,
                'currency' => 'PHP',
                'priority' => $data['priority'] ?? 'normal',
                'status' => VoucherStatus::Draft->value,
                'amount' => '0.00',
            ])->save();

            $this->replaceLines($voucher, $data['line_items'] ?? []);
            $this->audit($clerk, 'voucher_created', $voucher, null, $ip);

            return $voucher;
        });
    }

    public function update(Voucher $voucher, array $data, ?string $openedAt, User $clerk, ?string $ip = null): Voucher
    {
        return DB::transaction(function () use ($voucher, $data, $openedAt, $clerk, $ip) {
            /** @var Voucher $voucher */
            $voucher = Voucher::whereKey($voucher->id)->lockForUpdate()->firstOrFail();

            if (! in_array($voucher->status, [VoucherStatus::Draft->value, VoucherStatus::Returned->value], true)) {
                throw new ApiException('Only drafts and returned vouchers can be changed. This one is with a reviewer or finished.', 'VOUCHER_LOCKED', 409);
            }
            if ($openedAt !== null && $voucher->updated_at?->toIso8601String() !== $openedAt) {
                throw new ApiException('This voucher was changed in another window. Its latest version is loaded now; check it and save again.', 'VOUCHER_CHANGED', 409);
            }

            $before = ['amount' => (string) $voucher->amount];
            $voucher->forceFill($this->fields($data, (int) $voucher->company_id) + ['priority' => $data['priority'] ?? $voucher->priority])->save();
            $this->replaceLines($voucher, $data['line_items'] ?? []);
            $voucher->touch();
            $this->audit($clerk, 'voucher_updated', $voucher, $before, $ip);

            return $voucher;
        });
    }

    private function fields(array $data, int $companyId): array
    {
        $values = array_intersect_key($data, array_flip(self::FIELDS));

        // Payees (2026-11-26): a chosen saved payee sets the name; a typed name that is exactly a saved
        // active payee's (ignoring case) links to it; anything else is a one-off name with no link.
        $payee = ! empty($data['payee_id'])
            ? DB::table('payees')->where('company_id', $companyId)->where('id', $data['payee_id'])->first(['id', 'name'])
            : (! empty($values['payee_name'])
                ? DB::table('payees')->where('company_id', $companyId)->where('is_active', true)
                    ->whereRaw('LOWER(name) = ?', [mb_strtolower($values['payee_name'])])->first(['id', 'name'])
                : null);
        $values['payee_id'] = $payee?->id;
        if ($payee) {
            $values['payee_name'] = $payee->name;
        }
        if (($values['payment_method'] ?? null) !== 'bank') {
            // bank details only make sense for bank transfers
            $values = [...$values, 'bank_name' => null, 'bank_account_number' => null, 'bank_account_name' => null];
        }

        return $values;
    }

    /** @param list<array{description: string, quantity: string|int|float, unit?: ?string, unit_price: string|int|float}> $lines */
    private function replaceLines(Voucher $voucher, array $lines): void
    {
        DB::table('voucher_line_items')->where('voucher_id', $voucher->id)->delete();

        $totals = [];
        foreach (array_values($lines) as $i => $line) {
            $quantity = (string) $line['quantity'];
            $price = (string) $line['unit_price'];
            $total = VoucherMoney::lineTotal($quantity, $price);
            $totals[] = $total;

            DB::table('voucher_line_items')->insert([
                'voucher_id' => $voucher->id,
                'description' => $line['description'],
                'quantity' => $quantity,
                'unit' => $line['unit'] ?? null,
                'unit_price' => $price,
                'total_price' => $total,
                'sort_order' => $i,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        $voucher->forceFill(['amount' => VoucherMoney::sum($totals)])->save();
    }

    private function audit(User $clerk, string $action, Voucher $voucher, ?array $old, ?string $ip): void
    {
        AuditTrail::record([
            'user_id' => $clerk->id,
            'company_id' => $voucher->company_id,
            'action' => $action,
            'table_name' => 'vouchers',
            'record_id' => $voucher->id,
            'old_values' => $old,
            'new_values' => ['status' => $voucher->status, 'amount' => (string) $voucher->amount],
            'ip_address' => $ip,
        ]);
    }
}
