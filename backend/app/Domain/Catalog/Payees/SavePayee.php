<?php

namespace App\Domain\Catalog\Payees;

use App\Domain\Audit\AuditTrail;
use App\Exceptions\ApiException;
use App\Models\Company;
use App\Models\Payee;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Add, change, deactivate and reactivate a company's payees (2026-11-26). Any clerk of the company may
 * (user decision), and every change is one audit row (bank account numbers masked).
 *  - the same name or TIN twice in one company: 422 under that field (the unique indexes catch a race too)
 *  - edit sends the `updated_at` the form opened with: 409 PAYEE_CHANGED if someone saved in between
 *  - deactivated payees are not offered on new vouchers; their old vouchers keep the link
 */
class SavePayee
{
    public const FIELDS = ['name', 'payee_type_id', 'tin', 'default_payment_method', 'bank_name', 'bank_account_number', 'bank_account_name', 'address', 'email'];

    public function create(array $data, User $clerk, Company $company, ?string $ip = null): Payee
    {
        return $this->unique(fn () => DB::transaction(function () use ($data, $clerk, $company, $ip) {
            $this->assertFree($company->id, $data);
            $payee = new Payee;
            $payee->forceFill($this->fields($data) + [
                'company_id' => $company->id,
                'is_active' => true,
                'created_by' => $clerk->id,
                'updated_by' => $clerk->id,
            ])->save();

            $this->audit($clerk, 'payee_created', $payee, null, $this->snapshot($payee), $ip);

            return $payee;
        }));
    }

    public function update(Payee $payee, array $data, ?string $openedAt, User $clerk, ?string $ip = null): Payee
    {
        return $this->unique(fn () => DB::transaction(function () use ($payee, $data, $openedAt, $clerk, $ip) {
            /** @var Payee $payee */
            $payee = Payee::whereKey($payee->id)->lockForUpdate()->firstOrFail();
            if ($openedAt !== null && $payee->updated_at?->toIso8601String() !== $openedAt) {
                throw new ApiException('Someone else changed this payee while you were editing. Their version is loaded now; check it and save again.', 'PAYEE_CHANGED', 409);
            }
            $this->assertFree($payee->company_id, $data, $payee->id);

            $before = $this->snapshot($payee);
            $payee->forceFill($this->fields($data));
            if (! $payee->isDirty()) {
                return $payee; // nothing changed: no new version, no audit row
            }
            $payee->forceFill(['updated_by' => $clerk->id])->save();
            $after = $this->snapshot($payee);
            $changed = array_keys(array_diff_assoc(array_map('strval', $after), array_map('strval', $before)));
            $this->audit($clerk, 'payee_updated', $payee, array_intersect_key($before, array_flip($changed)), array_intersect_key($after, array_flip($changed)), $ip);

            return $payee;
        }));
    }

    public function setActive(Payee $payee, bool $active, User $clerk, ?string $ip = null): Payee
    {
        return DB::transaction(function () use ($payee, $active, $clerk, $ip) {
            /** @var Payee $payee */
            $payee = Payee::whereKey($payee->id)->lockForUpdate()->firstOrFail();
            if ($payee->is_active === $active) {
                throw new ApiException($active ? 'This payee is already active.' : 'This payee is already deactivated.',
                    $active ? 'PAYEE_ALREADY_ACTIVE' : 'PAYEE_ALREADY_INACTIVE', 409);
            }
            $payee->forceFill(['is_active' => $active, 'deactivated_at' => $active ? null : now(), 'updated_by' => $clerk->id])->save();
            $this->audit($clerk, $active ? 'payee_reactivated' : 'payee_deactivated', $payee, ['is_active' => ! $active], ['is_active' => $active], $ip);

            return $payee;
        });
    }

    private function fields(array $data): array
    {
        $values = array_intersect_key($data, array_flip(self::FIELDS));
        if (array_key_exists('tin', $values)) {
            $values['tin'] = PayeeText::tin($values['tin']);
        }
        if (array_key_exists('default_payment_method', $values) && $values['default_payment_method'] !== 'bank') {
            $values = [...$values, 'bank_name' => null, 'bank_account_number' => null, 'bank_account_name' => null];
        }

        return $values;
    }

    /** Same name (ignoring letter case and outer spaces) or same TIN in this company → 422 on that field. */
    private function assertFree(int $companyId, array $data, ?int $ignoreId = null): void
    {
        $others = Payee::query()->where('company_id', $companyId)->when($ignoreId, fn ($q) => $q->whereKeyNot($ignoreId));
        $errors = [];
        if (isset($data['name']) && (clone $others)->whereRaw('LOWER(TRIM(name)) = ?', [mb_strtolower(trim($data['name']))])->exists()) {
            $errors['name'] = 'A payee with this name already exists in this company.';
        }
        $tin = PayeeText::tin($data['tin'] ?? null);
        if ($tin && (clone $others)->where('tin', $tin)->exists()) {
            $errors['tin'] = 'Another payee in this company already has this TIN.';
        }
        if ($errors) {
            throw ValidationException::withMessages($errors);
        }
    }

    /** Two clerks saving the same name at once: the unique index stops the second → the same 422. */
    private function unique(callable $work): Payee
    {
        try {
            return $work();
        } catch (QueryException $e) {
            if (($e->errorInfo[1] ?? null) === 1062) {
                $field = str_contains($e->getMessage(), 'payees_company_id_tin_unique') ? 'tin' : 'name';
                throw ValidationException::withMessages([$field => $field === 'tin'
                    ? 'Another payee in this company already has this TIN.'
                    : 'A payee with this name already exists in this company.']);
            }
            throw $e;
        }
    }

    private function snapshot(Payee $payee): array
    {
        return [
            'name' => $payee->name,
            'payee_type_id' => $payee->payee_type_id,
            'tin' => $payee->tin,
            'default_payment_method' => $payee->default_payment_method,
            'bank_name' => $payee->bank_name,
            'bank_account_number' => PayeeText::maskAccount($payee->bank_account_number),
            'bank_account_name' => $payee->bank_account_name,
            'address' => $payee->address,
            'email' => $payee->email,
        ];
    }

    private function audit(User $clerk, string $action, Payee $payee, ?array $old, ?array $new, ?string $ip): void
    {
        AuditTrail::record([
            'user_id' => $clerk->id,
            'company_id' => $payee->company_id,
            'action' => $action,
            'table_name' => 'payees',
            'record_id' => $payee->id,
            'old_values' => $old,
            'new_values' => $new,
            'ip_address' => $ip,
        ]);
    }
}
