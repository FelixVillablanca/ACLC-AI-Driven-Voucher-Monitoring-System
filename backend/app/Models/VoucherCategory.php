<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * VoucherCategory <-> `voucher_categories` (e.g. "Office supplies", code OFF).
 * company_id NULL = a built-in category every company sees (read-only for Admins).
 */
class VoucherCategory extends Model
{
    protected $fillable = ['company_id', 'name', 'code', 'description', 'is_active'];

    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }
}
