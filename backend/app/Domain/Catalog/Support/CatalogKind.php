<?php

namespace App\Domain\Catalog\Support;

use App\Models\PayeeType;
use App\Models\VoucherCategory;
use App\Models\VoucherType;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

/**
 * The 3 lists an Admin configures on the Categories page (decided 2026-11-22: one page, 3 tabs):
 *   categories      voucher_categories  name, code, description, active / deactivated
 *   voucher_types   voucher_types       name
 *   payee_types     payee_types         name
 * Each list is per company. Categories also have built-in ones (company_id NULL) that every
 * company sees; Admins can't change those.
 *
 * "In use" = how many vouchers point at the item. A used item can't be deleted (the vouchers would
 * lose it): rename it, or (categories) deactivate it instead.
 */
final class CatalogKind
{
    public const KINDS = ['categories', 'voucher_types', 'payee_types'];

    private const CONFIG = [
        'categories' => ['model' => VoucherCategory::class, 'table' => 'voucher_categories', 'fk' => 'category_id', 'label' => 'category'],
        'voucher_types' => ['model' => VoucherType::class, 'table' => 'voucher_types', 'fk' => 'voucher_type_id', 'label' => 'voucher type'],
        'payee_types' => ['model' => PayeeType::class, 'table' => 'payee_types', 'fk' => 'payee_type_id', 'label' => 'payee type'],
    ];

    public function __construct(public readonly string $kind)
    {
        if (! isset(self::CONFIG[$kind])) {
            throw new \InvalidArgumentException("Unknown catalog kind {$kind}");
        }
    }

    public function table(): string
    {
        return self::CONFIG[$this->kind]['table'];
    }

    public function label(): string
    {
        return self::CONFIG[$this->kind]['label'];
    }

    public function hasDetails(): bool
    {
        return $this->kind === 'categories'; // code, description, active / deactivated
    }

    /** @return Builder<Model> */
    public function query(): Builder
    {
        return (self::CONFIG[$this->kind]['model'])::query();
    }

    /** The company's own items (+ built-in categories), each with vouchers_count. */
    public function listFor(int $companyId): Builder
    {
        $table = $this->table();
        $fk = self::CONFIG[$this->kind]['fk'];

        return $this->query()
            ->where(fn (Builder $q) => $this->hasDetails()
                ? $q->where("{$table}.company_id", $companyId)->orWhereNull("{$table}.company_id")
                : $q->where("{$table}.company_id", $companyId))
            ->select("{$table}.*")
            ->selectSub(DB::table('vouchers')->selectRaw('COUNT(*)')->whereColumn("vouchers.{$fk}", "{$table}.id"), 'vouchers_count')
            ->orderByRaw("{$table}.company_id IS NULL") // the company's own first, built-in after
            ->orderBy("{$table}.name");
    }

    /** One of the company's OWN items (never a built-in one), or 404. */
    public function findOwn(int $companyId, int $id): Model
    {
        return $this->query()->where('company_id', $companyId)->findOrFail($id);
    }

    public function usage(int $id): int
    {
        return DB::table('vouchers')->where(self::CONFIG[$this->kind]['fk'], $id)->count();
    }
}
