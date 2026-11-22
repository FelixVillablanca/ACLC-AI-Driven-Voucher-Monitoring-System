<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** VoucherType <-> `voucher_types` (e.g. "Cash advance", "Reimbursement"), one list per company. */
class VoucherType extends Model
{
    protected $fillable = ['company_id', 'name', 'created_by'];
}
