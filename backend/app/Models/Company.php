<?php

namespace App\Models;

use Database\Factories\CompanyFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A MODEL is PHP's "window" into one table. Company <-> `companies` table.
 * It lets you write Company::create([...]) or $company->departments
 * instead of writing SQL by hand.
 */
class Company extends Model
{
    /** @use HasFactory<CompanyFactory> */
    use HasFactory;

    protected $fillable = [
        'name', 'type', 'address', 'contact_email', 'contact_phone',
        'logo', 'fiscal_year_start', 'tin_number', 'is_active',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'fiscal_year_start' => 'date',
            'suspended_at' => 'datetime', // set when a Super Admin suspends the company
        ];
    }

    /** One company HAS MANY departments */
    public function departments(): HasMany
    {
        return $this->hasMany(Department::class);
    }

    /** People whose HOME company this is (users.company_id), e.g. the company's Admin */
    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    /** Users who were given access to this company (through user_company_access) */
    public function usersWithAccess(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'user_company_access')
            ->withPivot(['granted_status', 'granted_by', 'granted_at'])
            ->withTimestamps();
    }
}
