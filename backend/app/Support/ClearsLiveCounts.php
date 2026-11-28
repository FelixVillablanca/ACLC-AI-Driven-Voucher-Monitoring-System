<?php

namespace App\Support;

/**
 * For models with a company_id whose changes move the sidebar / dashboard numbers (Voucher, BudgetAllocation,
 * BudgetChangeRequest, FinancialReport): saving or deleting one renews the company's LiveCounts stamp.
 * Laravel calls `boot<TraitName>()` by itself when the model boots.
 *
 * Writes that skip Eloquent (DB::table()->update, mass updates) don't fire these events: the `company` middleware
 * covers them inside requests, and queued jobs that write directly call LiveCounts::companyChanged() themselves.
 */
trait ClearsLiveCounts
{
    protected static function bootClearsLiveCounts(): void
    {
        $clear = fn ($model) => LiveCounts::companyChanged($model->company_id);

        static::saved($clear);
        static::deleted($clear);
    }
}
