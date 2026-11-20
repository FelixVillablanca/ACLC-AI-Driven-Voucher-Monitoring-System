<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

#[Fillable([
    'employee_id', 'first_name', 'last_name', 'email', 'personal_email', 'password',
    'is_active', 'access_status', 'role', 'department_id', 'company_id',
    'profile_photo', 'last_login_at', 'deactivated_at',
])]
#[Hidden(['password', 'remember_token', 'two_factor_secret', 'two_factor_recovery_codes'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable;

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'password' => 'hashed',
            'is_active' => 'boolean',
            'last_login_at' => 'datetime',
            'deactivated_at' => 'datetime', // when the account was deactivated (NULL = never)
            // Two-step sign-in: the key and backup codes are ENCRYPTED in the database (APP_KEY)
            'two_factor_secret' => 'encrypted',
            'two_factor_recovery_codes' => 'encrypted:array',
            'two_factor_confirmed_at' => 'datetime',
            'two_factor_required_at' => 'datetime',
            'two_factor_setup_deadline' => 'datetime',
        ];
    }

    /** The user's home company */
    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    /** All companies this user may switch to (rows in user_company_access) */
    public function accessibleCompanies(): BelongsToMany
    {
        return $this->belongsToMany(Company::class, 'user_company_access')
            ->withPivot(['granted_status', 'granted_by', 'granted_at'])
            ->withTimestamps();
    }

    public function getFullNameAttribute(): string
    {
        return trim("{$this->first_name} {$this->last_name}");
    }

    /**
     * The account status the Super Admin screens show (one definition, used everywhere):
     *   inactive = deactivated / locked, or access rejected
     *   pending  = hasn't set a password yet, or has never signed in
     *   active   = everything else
     */
    public function accountStatus(): string
    {
        return match (true) {
            ! $this->is_active || $this->access_status === 'rejected' => 'inactive',
            $this->access_status === 'pending' || $this->last_login_at === null => 'pending',
            default => 'active',
        };
    }

    /** Two-step sign-in is ON (they set it up and confirmed a code). */
    public function hasTwoFactor(): bool
    {
        return $this->two_factor_confirmed_at !== null && $this->two_factor_secret !== null;
    }

    /** A Super Admin required two-step, and it isn't set up yet. */
    public function mustSetUpTwoFactor(): bool
    {
        return $this->two_factor_required_at !== null && ! $this->hasTwoFactor();
    }

    /** The setup window ran out: sign-in waits until it's done (no "set up later"). */
    public function twoFactorSetupOverdue(): bool
    {
        return $this->mustSetUpTwoFactor()
            && ($this->two_factor_setup_deadline === null || $this->two_factor_setup_deadline->isPast());
    }

    /**
     * What the "Two-step" column shows:
     *   on        ✓ On
     *   required  a Super Admin required it; waiting for them to set it up
     *   off       Off
     *   not_set_up  the account itself isn't set up yet (pending invitation)
     */
    public function twoFactorStatus(): string
    {
        return match (true) {
            $this->hasTwoFactor() => 'on',
            $this->access_status === 'pending' => 'not_set_up',
            $this->mustSetUpTwoFactor() => 'required',
            default => 'off',
        };
    }

    /** The same rule as accountStatus(), as a database filter: User::query()->withAccountStatus('pending') */
    public function scopeWithAccountStatus(Builder $query, string $status): Builder
    {
        return match ($status) {
            'inactive' => $query->where(fn (Builder $q) => $q->where('is_active', false)->orWhere('access_status', 'rejected')),
            'pending' => $query->where('is_active', true)->where('access_status', '!=', 'rejected')
                ->where(fn (Builder $q) => $q->where('access_status', 'pending')->orWhereNull('last_login_at')),
            default => $query->where('is_active', true)->where('access_status', 'accepted')->whereNotNull('last_login_at'),
        };
    }
}
