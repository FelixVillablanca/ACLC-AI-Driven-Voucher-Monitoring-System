<?php

namespace App\Domain\Identity\Account;

use App\Domain\Audit\AuditTrail;
use App\Exceptions\ApiException;
use App\Mail\SupportRequestMail;
use App\Models\Company;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Throwable;

/**
 * Help & guides → Contact support (Framer mudjUlcnp), user decisions 2026-11-26:
 *  - it goes to the Admin(s) of the company the person is working in (X-Company-ID): a bell notice
 *    (type support_request) and an email to their personal email (work emails don't receive mail)
 *  - an optional screenshot is attached to the email only, never stored
 *  - the Admin sees the voucher NUMBER only (Admins have no voucher access), never an amount
 * No Admin in the company → 409 NO_SUPPORT_CONTACT. A failed email doesn't undo the bell notice;
 * the answer says how many emails went out.
 */
class SendSupportMessage
{
    public const TOPICS = [
        'voucher' => 'Problem with a voucher',
        'payees' => 'Payees',
        'access' => 'Company access or switching companies',
        'account' => 'Signing in or my account',
        'other' => 'Something else',
    ];

    /** Accounting Officers / Supervisors (Framer menNRI3in, 2026-11-27): review, budgets and reports topics. */
    public const REVIEWER_TOPICS = [
        'voucher' => 'Problem with a voucher review',
        'budgets' => 'Budget allocation issue',
        'reports' => 'Forecasts or financial reports',
        'access' => 'Company access or switching companies',
        'account' => 'Signing in or my account',
        'other' => 'Something else',
    ];

    /** @return array<string, string> the topics a role can pick */
    public static function topicsFor(?string $role): array
    {
        return $role === 'accounting_clerk' ? self::TOPICS : self::REVIEWER_TOPICS;
    }

    /** @return array{admins: int, emailed: int} */
    public function send(User $sender, Company $company, string $topic, string $message, ?int $voucherId, ?UploadedFile $screenshot, ?string $ip = null): array
    {
        $admins = self::adminsOf($company);
        if ($admins->isEmpty()) {
            throw new ApiException(
                "{$company->name} has no active Admin yet, so there's nobody to send this to. Ask your Super Admin or manager.",
                'NO_SUPPORT_CONTACT', 409);
        }

        $voucherNumber = $voucherId ? DB::table('vouchers')->where('id', $voucherId)->value('voucher_number') : null;
        $voucherNumber = $voucherNumber && ! str_starts_with($voucherNumber, 'DRAFT-') ? $voucherNumber : ($voucherId ? 'a draft' : null);
        $label = self::topicsFor($sender->role)[$topic];

        DB::transaction(function () use ($admins, $sender, $company, $label, $message, $voucherNumber, $topic, $screenshot, $ip) {
            foreach ($admins as $admin) {
                Notification::create([
                    'recipient_id' => $admin->id,
                    'type' => 'support_request',
                    'title' => "Support request from {$sender->full_name}: {$label}",
                    'message' => ($voucherNumber ? "About {$voucherNumber}. " : '').Str::limit($message, 220),
                    'voucher_id' => null, // Admins have no voucher access: the number is in the text only
                ]);
            }

            AuditTrail::record([
                'user_id' => $sender->id,
                'company_id' => $company->id,
                'action' => 'support_request_sent',
                'table_name' => 'notifications',
                'new_values' => ['topic' => $topic, 'voucher' => $voucherNumber, 'to' => $admins->pluck('full_name')->all(), 'screenshot' => (bool) $screenshot],
                'ip_address' => $ip,
            ]);
        });

        $shot = $screenshot ? [
            'path' => $screenshot->getRealPath(),
            'name' => 'screenshot.'.($screenshot->guessExtension() ?: 'png'),
            'mime' => $screenshot->getMimeType(),
        ] : null;

        $emailed = 0;
        foreach ($admins as $admin) {
            try {
                Mail::to($admin->personal_email ?: $admin->email)
                    ->send(new SupportRequestMail($admin, $sender, $company, $label, $message, $voucherNumber, $shot));
                $emailed++;
            } catch (Throwable $e) {
                Log::warning('Support request email failed', ['admin' => $admin->id, 'error' => $e->getMessage()]);
            }
        }

        return ['admins' => $admins->count(), 'emailed' => $emailed];
    }

    /** The active, set-up Admins in charge of a company. */
    public static function adminsOf(Company $company)
    {
        return User::query()->where('role', 'admin')->where('company_id', $company->id)
            ->where('is_active', true)->where('access_status', 'accepted')
            ->orderBy('first_name')->get(['id', 'first_name', 'last_name', 'email', 'personal_email']);
    }
}
