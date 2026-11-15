<?php

namespace App\Models;

use Database\Factories\DepartmentFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** Department <-> `departments` table */
class Department extends Model
{
    /** @use HasFactory<DepartmentFactory> */
    use HasFactory;

    protected $fillable = [
        'company_id', 'name', 'code', 'description', 'head_user_id', 'is_active',
    ];

    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }

    /** A department BELONGS TO one company */
    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    /** The user who leads this department */
    public function head(): BelongsTo
    {
        return $this->belongsTo(User::class, 'head_user_id');
    }

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }
}
