<?php

namespace App\Jobs;

use App\Domain\AI\OpenAi\OpenAiClient;
use App\Domain\AI\OpenAi\OpenAiSpend;
use App\Domain\Reporting\Actions\GenerateReport;
use App\Domain\Reporting\Support\ReportPrompt;
use App\Models\Company;
use App\Models\FinancialReport;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use RuntimeException;
use Throwable;

/**
 * Writes a financial report's narrative summary with OpenAI, in the background (2026-11-27).
 *   no OPENAI_API_KEY             → summary_status not_set_up (the report itself is complete)
 *   monthly cap reached + pause   → paused (Super Admin's Global settings)
 *   otherwise                     → writing → ready (paragraphs, highlights, model, tokens, cost)
 * A failure is retried (3 tries, 1 then 5 minutes apart); after the last one the status is failed and the person
 * who made the report (or the officers, for an automatic one) gets a bell notice, as they do when it's ready.
 */
class WriteReportSummary implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public array $backoff = [60, 300];

    public int $timeout = 90;

    public function __construct(public int $reportId) {}

    public function handle(OpenAiClient $openai, OpenAiSpend $spend): void
    {
        $report = FinancialReport::with('department:id,name')->find($this->reportId);
        if (! $report || ! in_array($report->summary_status, ['queued', 'writing'], true)) {
            return;
        }
        if (! $openai->configured()) {
            $report->forceFill(['summary_status' => 'not_set_up', 'summary_error' => null])->save();
            $report->is_scheduled && GenerateReport::notify($report, ready: true); // the officers still need to hear about it

            return;
        }
        if ($spend->paused()) {
            $report->forceFill(['summary_status' => 'paused', 'summary_error' => 'The monthly OpenAI spend cap was reached.'])->save();
            $report->is_scheduled && GenerateReport::notify($report, ready: true);

            return;
        }

        $report->forceFill(['summary_status' => 'writing', 'summary_attempts' => $report->summary_attempts + 1])->save();
        $company = Company::find($report->company_id);
        $answer = $openai->chatJson(
            ReportPrompt::SYSTEM,
            ReportPrompt::user($company?->name ?? '', (string) $report->title, $report->department?->name, $report->figures ?? []),
        );

        $paragraphs = array_values(array_filter(array_map(fn ($p) => trim((string) $p), (array) ($answer['content']['paragraphs'] ?? []))));
        if ($paragraphs === []) {
            throw new RuntimeException('OpenAI sent no summary text.');
        }
        $highlights = collect((array) ($answer['content']['highlights'] ?? []))->take(3)
            ->map(fn ($h) => ['text' => mb_strimwidth(trim((string) ($h['text'] ?? '')), 0, 40, '…'),
                'tone' => in_array($h['tone'] ?? '', ['danger', 'warning', 'success', 'neutral'], true) ? $h['tone'] : 'neutral'])
            ->filter(fn ($h) => $h['text'] !== '')->values()->all();

        $report->forceFill([
            'ai_summary' => implode("\n\n", $paragraphs),
            'summary_highlights' => $highlights,
            'summary_status' => 'ready',
            'summary_model' => $answer['model'],
            'summary_tokens' => $answer['prompt_tokens'] + $answer['completion_tokens'],
            'summary_cost_usd' => OpenAiClient::cost($answer['prompt_tokens'], $answer['completion_tokens']),
            'summary_error' => null,
            'summary_generated_at' => now(),
        ])->save();

        GenerateReport::notify($report, ready: true);
    }

    /** The last try failed: keep the report, mark the summary failed and tell the person. */
    public function failed(?Throwable $e): void
    {
        $report = FinancialReport::find($this->reportId);
        if (! $report) {
            return;
        }
        $report->forceFill(['summary_status' => 'failed', 'summary_error' => mb_strimwidth((string) $e?->getMessage(), 0, 480, '…')])->save();
        GenerateReport::notify($report, ready: false);
    }
}
