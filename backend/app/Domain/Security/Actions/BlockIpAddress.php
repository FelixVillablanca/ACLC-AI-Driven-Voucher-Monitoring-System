<?php

namespace App\Domain\Security\Actions;

use App\Domain\Audit\AuditTrail;
use App\Domain\Security\Queries\IpActivity;
use App\Domain\Security\Support\OwnerActivity;
use App\Exceptions\ApiException;
use App\Mail\SignInAttemptsMail;
use App\Models\BlockedIp;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Throwable;

/**
 * "Block 180.190.77.4?" (Framer AL8). From then on, sign-ins from that address are refused for
 * every company (AuthenticateUser), until it expires or a Super Admin unblocks it.
 *
 * Safety rules:
 *   - you can't block the address you are using right now (you'd lock yourself out)
 *   - an address that's already blocked → 409
 * After the commit, optionally: an email to each real account that was tried from that address.
 */
class BlockIpAddress
{
    public const DURATIONS = ['24h' => 24, '7d' => 168, 'forever' => null]; // hours

    public function __construct(private IpActivity $activity) {}

    /** @return array{block: BlockedIp, accounts_emailed: ?int} */
    public function handle(User $by, string $ip, string $duration, string $reason, bool $notifyAccounts, ?string $currentIp): array
    {
        if ($currentIp !== null && $ip === $currentIp) {
            throw new ApiException('That’s the address you’re using right now. Blocking it would sign you out too.', 'IP_IS_YOURS', 422);
        }

        $block = DB::transaction(function () use ($by, $ip, $duration, $reason, $currentIp) {
            // lock the address's rows so two Super Admins can't block it twice at the same moment
            if (BlockedIp::where('ip_address', $ip)->active()->lockForUpdate()->exists()) {
                throw new ApiException("{$ip} is already blocked.", 'IP_ALREADY_BLOCKED', 409);
            }

            $hours = self::DURATIONS[$duration];
            $block = BlockedIp::create([
                'ip_address' => $ip,
                'reason' => $reason,
                'expires_at' => $hours === null ? null : now()->addHours($hours),
                'blocked_by' => $by->id,
            ]);

            AuditTrail::record([
                'user_id' => $by->id,
                'action' => 'ip_blocked',
                'table_name' => 'blocked_ips',
                'record_id' => $block->id,
                'new_values' => ['ip_address' => $ip, 'duration' => $duration, 'expires_at' => $block->expires_at?->toIso8601String(), 'reason' => $reason],
                'ip_address' => $currentIp,
            ]);

            OwnerActivity::tellOtherOwners($by, 'security_alert', 'IP address blocked',
                "{$by->full_name} blocked {$ip}".($hours === null ? ' until it is unblocked' : ' for '.($hours === 24 ? '24 hours' : '7 days')).": \"{$reason}\".");

            return $block;
        });

        return ['block' => $block, 'accounts_emailed' => $notifyAccounts ? $this->emailAccountsTried($ip) : null];
    }

    /** "Email Liza Santos and John Doe that someone tried their accounts." Returns how many emails went out. */
    private function emailAccountsTried(string $ip): int
    {
        $sent = 0;
        foreach ($this->activity->accountsTried($ip) as $user) {
            $to = $user->personal_email;
            if (! $to) {
                continue; // work addresses (…@Clerk.com) aren't real inboxes
            }
            try {
                Mail::to($to)->send(new SignInAttemptsMail($user, $ip));
                $sent++;
            } catch (Throwable $e) {
                Log::error('Sign-in attempts email failed', ['user_id' => $user->id, 'error' => $e->getMessage()]);
            }
        }

        return $sent;
    }
}
