<?php

namespace App\Domain\AI\OpenAi;

use Illuminate\Support\Facades\Http;
use RuntimeException;

/**
 * The one place that talks to OpenAI (2026-11-27), with Laravel's built-in HTTP client (no extra library).
 * Asks the chat model for a JSON answer and reports the tokens used, so the cost can count towards the Super
 * Admin's monthly cap. Throws on any failure (timeout, 4xx/5xx, unreadable answer): the queued job retries.
 * Not set up = no OPENAI_API_KEY in .env (configured() is false).
 */
class OpenAiClient
{
    public function configured(): bool
    {
        return filled(config('services.openai.key'));
    }

    public function model(): string
    {
        return (string) config('services.openai.model', 'gpt-4o-mini');
    }

    /**
     * @return array{content: array, prompt_tokens: int, completion_tokens: int, model: string}
     */
    public function chatJson(string $system, string $user, int $maxTokens = 700): array
    {
        if (! $this->configured()) {
            throw new RuntimeException('OpenAI is not set up (no OPENAI_API_KEY).');
        }
        $response = Http::withToken((string) config('services.openai.key'))
            ->acceptJson()
            ->timeout((int) config('services.openai.timeout', 45))
            ->post(rtrim((string) config('services.openai.url'), '/').'/chat/completions', [
                'model' => $this->model(),
                'temperature' => 0.3,
                'max_tokens' => $maxTokens,
                'response_format' => ['type' => 'json_object'],
                'messages' => [
                    ['role' => 'system', 'content' => $system],
                    ['role' => 'user', 'content' => $user],
                ],
            ]);

        if ($response->failed()) {
            $message = $response->json('error.message') ?? 'HTTP '.$response->status();
            throw new RuntimeException('OpenAI answered with an error: '.mb_strimwidth((string) $message, 0, 300, '…'));
        }
        $content = json_decode((string) $response->json('choices.0.message.content'), true);
        if (! is_array($content)) {
            throw new RuntimeException('OpenAI sent an answer that isn’t valid JSON.');
        }

        return [
            'content' => $content,
            'prompt_tokens' => (int) $response->json('usage.prompt_tokens', 0),
            'completion_tokens' => (int) $response->json('usage.completion_tokens', 0),
            'model' => (string) $response->json('model', $this->model()),
        ];
    }

    /** US dollars for a call (list price per 1 million tokens, config/services.php). */
    public static function cost(int $promptTokens, int $completionTokens): float
    {
        return round($promptTokens / 1_000_000 * (float) config('services.openai.price_input_per_million')
            + $completionTokens / 1_000_000 * (float) config('services.openai.price_output_per_million'), 6);
    }
}
