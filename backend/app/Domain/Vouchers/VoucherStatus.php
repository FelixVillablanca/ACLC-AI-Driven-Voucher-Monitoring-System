<?php

namespace App\Domain\Vouchers;

/**
 * The voucher statuses (vouchers.status), agreed 2026-11-22:
 *   draft → pending (with the Accounting Officer, step 1) → under_review (with the Supervisor, step 2)
 *         → approved | rejected;  pending / under_review → returned (back to the clerk) → pending
 *   draft / returned → cancelled
 * The single state machine that moves vouchers between them comes with Phase 3 (TransitionVoucher).
 */
enum VoucherStatus: string
{
    case Draft = 'draft';
    case Pending = 'pending';
    case UnderReview = 'under_review';
    case Returned = 'returned';
    case Approved = 'approved';
    case Rejected = 'rejected';
    case Cancelled = 'cancelled';

    /** Waiting for a reviewer (the clerk can't change it meanwhile). */
    public static function inReview(): array
    {
        return [self::Pending->value, self::UnderReview->value];
    }
}
