<?php

namespace App\Domain\Notifications;

/**
 * ENUM = a fixed list of allowed values, written once in code instead of as
 * loose strings everywhere. These match the `notifications.type` column.
 *
 * Each type belongs to a CATEGORY. That's the word shown after the time
 * ("2 min ago · Security") and what the "Security" tab filters on.
 */
enum NotificationType: string
{
    // Voucher workflow (Phase 4+)
    case VoucherApproved = 'voucher_approved';
    case VoucherRejected = 'voucher_rejected';
    case VoucherPending = 'voucher_pending';
    case VoucherReturned = 'voucher_returned'; // added 2026-11-26: a reviewer sent it back to the clerk
    case AnomalyFlagged = 'anomaly_flagged';
    case BudgetAlert = 'budget_alert';
    case BudgetChange = 'budget_change'; // added 2026-11-27: a budget edit waits for a Supervisor's sign-off

    // Admin / system setup (added 2026-11-16)
    case SecurityAlert = 'security_alert';
    case AccessChanged = 'access_changed';
    case UserChanged = 'user_changed';
    case DepartmentAlert = 'department_alert';
    case CompanyChanged = 'company_changed';

    // Platform (added 2026-11-21): backups and other system jobs, for Super Admins
    case SystemAlert = 'system_alert';

    // Clerk drafts (added 2026-11-25): "your draft will be deleted in 3 days" / "old drafts were deleted"
    case DraftExpiry = 'draft_expiry';

    // Help & guides (added 2026-11-26): a clerk's "Contact support" message, to their company's Admin
    case SupportRequest = 'support_request';

    // Financial reports (added 2026-11-27): a report (and its AI summary) is ready, or its summary failed
    case ReportReady = 'report_ready';

    public function category(): string
    {
        return match ($this) {
            self::VoucherApproved, self::VoucherRejected, self::VoucherPending, self::VoucherReturned, self::DraftExpiry => 'vouchers',
            self::AnomalyFlagged => 'ai',
            self::BudgetAlert, self::BudgetChange => 'budgets',
            self::SecurityAlert => 'security',
            self::AccessChanged => 'access',
            self::UserChanged => 'users',
            self::DepartmentAlert => 'departments',
            self::CompanyChanged => 'companies',
            self::SystemAlert => 'system',
            self::SupportRequest => 'support',
            self::ReportReady => 'reports',
        };
    }

    /** @return array<int, string> every type value in one category */
    public static function valuesInCategory(string $category): array
    {
        return array_values(array_map(
            fn (self $type) => $type->value,
            array_filter(self::cases(), fn (self $type) => $type->category() === $category),
        ));
    }

    /** @return array<int, string> */
    public static function categories(): array
    {
        return array_values(array_unique(array_map(fn (self $type) => $type->category(), self::cases())));
    }
}
