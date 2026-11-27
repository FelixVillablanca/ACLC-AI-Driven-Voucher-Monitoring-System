<?php

namespace Tests\Feature\Api;

use Tests\TestCase;

/**
 * Phase 7 step 1 (2026-11-28): every /api answer carries the security headers (SetSecurityHeaders), HSTS only over HTTPS.
 * Run:  php artisan test --filter=SecurityHeadersTest
 */
class SecurityHeadersTest extends TestCase
{
    public function test_every_api_answer_has_the_security_headers(): void
    {
        $res = $this->getJson('/api/v1/health');
        $res->assertHeader('X-Content-Type-Options', 'nosniff')
            ->assertHeader('X-Frame-Options', 'DENY')
            ->assertHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
            ->assertHeader('Cross-Origin-Opener-Policy', 'same-origin')
            ->assertHeaderMissing('Strict-Transport-Security')
            ->assertHeaderMissing('X-Powered-By');
        $this->assertStringContainsString("frame-ancestors 'none'", $res->headers->get('Content-Security-Policy'));

        // errors too (an unknown address, an unauthenticated call)
        $this->getJson('/api/v1/no-such-route')->assertNotFound()->assertHeader('X-Content-Type-Options', 'nosniff');
        $this->getJson('/api/v1/auth/me')->assertUnauthorized()->assertHeader('X-Frame-Options', 'DENY');
    }

    public function test_hsts_only_over_https(): void
    {
        $this->getJson('https://localhost/api/v1/health')
            ->assertHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
}
