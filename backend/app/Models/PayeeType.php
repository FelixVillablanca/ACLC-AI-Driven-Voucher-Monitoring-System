<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** PayeeType <-> `payee_types` (e.g. "Supplier", "Employee"), one list per company. */
class PayeeType extends Model
{
    protected $fillable = ['company_id', 'name', 'created_by'];
}
