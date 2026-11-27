<?php

namespace App\Domain\Reporting\Support;

/**
 * What a report summary asks OpenAI (2026-11-27). PRIVACY: only the report's totals and counts go out:
 * company / department / category names, amounts, counts, percentages and voucher NUMBERS of flagged vouchers.
 * Never payee names, people's names, descriptions, line items or files (the Global settings card promises
 * "totals only"). The answer is JSON: 2–3 short paragraphs + up to 3 highlight chips.
 */
class ReportPrompt
{
    public const SYSTEM = 'You write short narrative summaries of company expense reports for an accounting team in the Philippines. '
        .'Use ONLY the numbers in the data you are given. Never invent figures, causes, people or vouchers. '
        .'Money is in Philippine pesos: write it like ₱1.28M, ₱486k or ₱12,500. '
        .'Write 2 or 3 short paragraphs (at most 70 words each) in plain English: what was spent and how it compares with the '
        .'previous period, which departments or categories drove it, flagged vouchers and budget use if the data has them. '
        .'Say "the automatic check flagged" (not "the AI flagged"). Do not give advice beyond what the numbers show. '
        .'Answer as JSON: {"paragraphs": ["...", "..."], "highlights": [{"text": "IT spend +31%", "tone": "danger|warning|success|neutral"}]} '
        .'with at most 3 highlights of at most 4 words each.';

    /** The user message: the frozen figures, trimmed to what is allowed out. */
    public static function user(string $company, string $title, ?string $department, array $figures): string
    {
        $data = [
            'company' => $company,
            'report' => $title,
            'department' => $department ?? 'All departments',
            'period' => $figures['period'],
            'total_spend' => $figures['total_spend'],
            'previous_period_spend' => $figures['previous_spend'],
            'change_vs_previous_pct' => $figures['change_pct'],
            'vouchers_approved' => $figures['approved'],
            'vouchers_rejected' => $figures['rejected'],
            'vouchers_returned' => $figures['returned'],
            'flagged_by_automatic_check' => $figures['flagged'],
            'flagged_still_open' => $figures['flagged_open'],
            'budget_this_fiscal_year' => $figures['budget'],
            'by_department' => $figures['departments'] ?? null,
            'by_category' => $figures['categories'] ?? null,
            'flagged_vouchers' => isset($figures['flagged_list'])
                ? array_map(fn ($v) => ['number' => $v['voucher_number'], 'amount' => $v['amount'], 'status' => $v['status'], 'finding' => $v['finding']], $figures['flagged_list'])
                : null,
            'forecast_next_month' => $figures['forecast'] ?? null,
        ];

        return 'Summarise this expense report. Data (JSON): '.json_encode(array_filter($data, fn ($v) => $v !== null), JSON_UNESCAPED_UNICODE);
    }
}
