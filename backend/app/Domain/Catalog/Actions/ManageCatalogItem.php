<?php

namespace App\Domain\Catalog\Actions;

use App\Domain\Audit\AuditTrail;
use App\Domain\Catalog\Support\CatalogKind;
use App\Domain\Tenancy\Support\AdminCompany;
use App\Exceptions\ApiException;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Add / edit / delete / (de)activate an item of one of the 3 lists on the Categories page.
 * Always the Admin's OWN company; built-in categories can't be touched (404).
 * Every change: one transaction, row locked, one audit row (catalog_created / _updated / _deleted /
 * _deactivated / _reactivated, table = the list's table, so Recent activity can say what it was).
 */
class ManageCatalogItem
{
    public function create(CatalogKind $kind, array $data, User $admin, ?string $ip = null): Model
    {
        $company = AdminCompany::activeFor($admin, "a {$kind->label()}");

        return DB::transaction(function () use ($kind, $data, $admin, $ip, $company) {
            $values = ['company_id' => $company->id, 'name' => $data['name']];
            if ($kind->hasDetails()) {
                $values += ['code' => $data['code'] ?? null, 'description' => $data['description'] ?? null, 'is_active' => true];
            } else {
                $values['created_by'] = $admin->id;
            }

            $item = $this->save(fn () => $kind->query()->create($values));
            $this->audit($kind, 'catalog_created', $item, null, $this->snapshot($kind, $item), $admin, $ip);

            return $item;
        });
    }

    /** @return array{item: Model, changed: list<string>} */
    public function update(CatalogKind $kind, int $id, array $data, ?string $openedAt, User $admin, ?string $ip = null): array
    {
        $company = AdminCompany::activeFor($admin, 'changes');

        return DB::transaction(function () use ($kind, $id, $data, $openedAt, $admin, $ip, $company) {
            $item = $kind->query()->where('company_id', $company->id)->lockForUpdate()->findOrFail($id);

            if ($openedAt !== null && $item->updated_at?->toIso8601String() !== $openedAt) {
                throw new ApiException("Someone else changed “{$item->name}” while you were editing. The latest version is loaded now.", 'CATALOG_CHANGED', 409);
            }

            $fields = $kind->hasDetails() ? ['name', 'code', 'description'] : ['name'];
            $old = [];
            $new = [];
            foreach ($fields as $field) {
                $value = $data[$field] ?? null;
                if ($item->{$field} != $value) {
                    $old[$field] = $item->{$field};
                    $new[$field] = $value;
                }
            }
            if ($new === []) {
                return ['item' => $item, 'changed' => []];
            }

            $this->save(fn () => $item->forceFill($new)->save());
            $this->audit($kind, 'catalog_updated', $item, $old, ['name' => $item->name, ...$new], $admin, $ip);

            return ['item' => $item, 'changed' => array_keys($new)];
        });
    }

    /** Only when no voucher uses it (409 CATALOG_IN_USE otherwise). */
    public function delete(CatalogKind $kind, int $id, User $admin, ?string $ip = null): void
    {
        $company = AdminCompany::activeFor($admin, 'changes');

        DB::transaction(function () use ($kind, $id, $admin, $ip, $company) {
            $item = $kind->query()->where('company_id', $company->id)->lockForUpdate()->findOrFail($id);

            if (($used = $kind->usage($item->id)) > 0) {
                throw new ApiException(
                    "“{$item->name}” is used by {$used} ".($used === 1 ? 'voucher' : 'vouchers').', so it can’t be deleted. '
                    .($kind->hasDetails() ? 'Deactivate it instead, so it isn’t offered any more.' : 'Rename it instead.'),
                    'CATALOG_IN_USE',
                    409,
                );
            }

            $snapshot = $this->snapshot($kind, $item);
            $item->delete();
            $this->audit($kind, 'catalog_deleted', $item, $snapshot, ['name' => $snapshot['name']], $admin, $ip);
        });
    }

    /** Categories only: deactivated = not offered for new vouchers; old vouchers keep it. */
    public function setActive(CatalogKind $kind, int $id, bool $active, User $admin, ?string $ip = null): Model
    {
        $company = AdminCompany::activeFor($admin, 'changes');

        return DB::transaction(function () use ($kind, $id, $active, $admin, $ip, $company) {
            $item = $kind->query()->where('company_id', $company->id)->lockForUpdate()->findOrFail($id);

            if ((bool) $item->is_active === $active) {
                throw new ApiException(
                    $active ? "“{$item->name}” is already active." : "“{$item->name}” is already deactivated.",
                    $active ? 'CATALOG_ALREADY_ACTIVE' : 'CATALOG_ALREADY_INACTIVE',
                    409,
                );
            }

            $item->forceFill(['is_active' => $active])->save();
            $this->audit($kind, $active ? 'catalog_reactivated' : 'catalog_deactivated', $item,
                ['is_active' => ! $active], ['name' => $item->name, 'is_active' => $active], $admin, $ip);

            return $item;
        });
    }

    /** A race between two saves that both passed the form check: the unique index refuses the second. */
    private function save(callable $write)
    {
        try {
            return $write();
        } catch (UniqueConstraintViolationException) {
            throw ValidationException::withMessages(['name' => 'Your company already has one with this name or code.']);
        }
    }

    private function snapshot(CatalogKind $kind, Model $item): array
    {
        return $kind->hasDetails()
            ? ['name' => $item->name, 'code' => $item->code, 'description' => $item->description]
            : ['name' => $item->name];
    }

    private function audit(CatalogKind $kind, string $action, Model $item, ?array $old, ?array $new, User $admin, ?string $ip): void
    {
        AuditTrail::record([
            'user_id' => $admin->id,
            'company_id' => $item->company_id,
            'action' => $action,
            'table_name' => $kind->table(),
            'record_id' => $item->id,
            'old_values' => $old,
            'new_values' => $new,
            'ip_address' => $ip,
        ]);
    }
}
