<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    // Python ML microservice (Phase 5). Empty URL = not set up yet; the System health check says so.
    'ml' => [
        'url' => env('ML_SERVICE_URL'),
    ],

    // OpenAI (2026-11-27): writes the financial reports' narrative summaries. Empty key = not set up: reports
    // still build and the summary says so. Only totals / counts are sent (Domain/Reporting/Support/ReportPrompt).
    // Prices are US dollars per 1 million tokens (gpt-4o-mini list price); used for the Super Admin's monthly cap.
    'openai' => [
        'key' => env('OPENAI_API_KEY'),
        'model' => env('OPENAI_MODEL', 'gpt-4o-mini'),
        'url' => env('OPENAI_URL', 'https://api.openai.com/v1'),
        'timeout' => (int) env('OPENAI_TIMEOUT', 45),
        'price_input_per_million' => (float) env('OPENAI_PRICE_INPUT', 0.15),
        'price_output_per_million' => (float) env('OPENAI_PRICE_OUTPUT', 0.60),
    ],

    // System health: the address the scheduler calls every minute to check the web app & API.
    // Must be where Laravel itself answers (dev: php artisan serve on :8000), NOT XAMPP's Apache on :80.
    'health' => [
        'web_url' => env('HEALTH_WEB_URL', env('APP_URL', 'http://localhost')),
    ],

];
