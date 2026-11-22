<?php

namespace App\Domain\Identity\Account;

use App\Domain\Audit\AuditTrail;
use App\Domain\Security\Actions\RaiseSecurityAlert;
use App\Exceptions\ApiException;
use App\Models\SecurityAlert;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * "My profile" → Edit: the person changes their own name and personal email.
 *
 * NOT editable here, on purpose:
 *   - the sign-in email: it follows the role's domain and is built by the server (RoleEmailDomains)
 *   - role, company, department, Employee ID: someone above them decides those
 *
 * The personal email is where password-reset links go, so changing it needs the current
 * password (checked by the Form Request), and for Admins / Super Admins the other Super Admins
 * get a Low security alert: a thief who changed it could otherwise receive the next reset link.
 *
 * OPTIMISTIC CONCURRENCY: the screen sends the values it showed (`was`); if the account changed
 * in the meantime (another tab, or a Super Admin edited the personal email), the save is refused
 * with 409 instead of silently overwriting the newer values.
 */
class UpdateOwnProfile
{
    public const FIELDS = ['first_name', 'last_name', 'personal_email'];

    public function __construct(private RaiseSecurityAlert $raise) {}

    /**
     * @param  array<string, string>  $changes  only the fields being changed
     * @param  array<string, ?string>  $was  what the screen showed for those fields
     * @return array<int, string> the fields that changed
     */
    public function handle(User $user, array $changes, array $was, ?string $ip, ?string $device): array
    {
        return DB::transaction(function () use ($user, $changes, $was, $ip, $device) {
            /** @var User $fresh */
            $fresh = User::whereKey($user->id)->lockForUpdate()->firstOrFail();

            foreach ($changes as $field => $value) {
                if (array_key_exists($field, $was) && (string) $was[$field] !== (string) $fresh->{$field}) {
                    throw new ApiException('Your profile was changed somewhere else. Reload to see the newest details.', 'PROFILE_CHANGED', 409);
                }
            }

            $changed = array_filter($changes, fn ($value, $field) => (string) $value !== (string) $fresh->{$field}, ARRAY_FILTER_USE_BOTH);
            if ($changed === []) {
                throw new ApiException('Nothing changed.', 'NOTHING_CHANGED', 409);
            }

            $old = array_intersect_key($fresh->only(self::FIELDS), $changed);
            $fresh->forceFill($changed)->save();
            $user->setRawAttributes($fresh->getAttributes(), true); // the caller's copy shows the new values too

            AuditTrail::record([
                'user_id' => $user->id,
                'company_id' => $user->company_id,
                'action' => 'profile_updated',
                'table_name' => 'users',
                'record_id' => $user->id,
                'old_values' => $old,
                'new_values' => $changed,
                'ip_address' => $ip,
            ]);

            if (isset($changed['personal_email']) && in_array($user->role, ['admin', 'super_admin'], true)) {
                $this->raise->handle([
                    'type' => SecurityAlert::TYPE_PERSONAL_EMAIL_CHANGED,
                    'severity' => 'low',
                    'user_id' => $user->id,
                    'subject_email' => strtolower($user->email),
                    'ip_address' => $ip,
                    'device' => $device,
                    'details' => ['from' => $old['personal_email'] ?? null, 'to' => $changed['personal_email']],
                ], 'Personal email changed', "{$user->full_name} changed the personal email their reset links go to.", [$user->id]);
            }

            return array_keys($changed);
        });
    }
}
