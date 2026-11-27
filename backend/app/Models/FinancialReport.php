<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * FinancialReport <-> `financial_reports` (Framer ARxG8Aa6F / UmSNc_71u / ZoAX4DKjk, 2026-11-27).
 * `figures` = the report's numbers frozen when it was made; the summary is written afterwards by the queued job
 * WriteReportSummary (OpenAI). report_type: monthly | quarterly | custom (a department report over any dates).
 */
class FinancialReport extends Model
{
    protected $fillable = [
        'company_id', 'department_id', 'report_type', 'title', 'period_start', 'period_end', 'total_vouchers', 'total_amount',
        'approved_count', 'rejected_count', 'anomalies_flag', 'figures', 'includes', 'ai_summary', 'summary_status',
        'summary_highlights', 'summary_model', 'summary_tokens', 'summary_cost_usd', 'summary_error', 'summary_attempts',
        'summary_generated_at', 'file_path', 'generated_by', 'is_scheduled', 'generated_at',
    ];

    protected function casts(): array
    {
        return [
            'period_start' => 'date',
            'period_end' => 'date',
            'total_amount' => 'decimal:2',
            'figures' => 'array',
            'includes' => 'array',
            'summary_highlights' => 'array',
            'summary_cost_usd' => 'decimal:6',
            'summary_generated_at' => 'datetime',
            'is_scheduled' => 'boolean',
            'generated_at' => 'datetime',
        ];
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    public function generator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'generated_by');
    }
}
