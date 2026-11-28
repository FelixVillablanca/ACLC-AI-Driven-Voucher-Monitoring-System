<?php

namespace Tests\Feature\Api;

use App\Models\Company;
use App\Models\PayeeType;
use App\Models\User;
use App\Models\VoucherCategory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Phase 7 step 1 (2026-11-28): a repeated POST with the same Idempotency-Key gets the first answer back and does the
 * work once (EnsureIdempotency, table idempotency_keys).
 * Run:  php artisan test --filter=IdempotencyTest
 */
class IdempotencyTest extends TestCase
{
    use RefreshDatabase;

    private Company $apex;

    private User $clerk;

    private array $draft;

    protected function setUp(): void
    {
        parent::setUp();
        $this->apex = Company::factory()->create();
        $this->clerk = User::factory()->create(['company_id' => $this->apex->id]);
        $this->clerk->accessibleCompanies()->attach($this->apex->id, ['granted_status' => 'accepted']);
        $this->draft = [
            'category_id' => VoucherCategory::create(['company_id' => $this->apex->id, 'name' => 'Travel'])->id,
            'payment_method' => 'cash', 'payee_name' => 'Grab', 'payee_type_id' => PayeeType::create(['company_id' => $this->apex->id, 'name' => 'Supplier'])->id,
            'description' => 'Taxi', 'line_items' => [['description' => 'Taxi', 'quantity' => '1', 'unit_price' => '250.00']],
        ];
    }

    private function send(array $data, ?string $key)
    {
        $headers = ['X-Company-ID' => (string) $this->apex->id] + ($key ? ['Idempotency-Key' => $key] : []);

        return $this->actingAs($this->clerk)->json('POST', '/api/v1/vouchers', $data, $headers);
    }

    public function test_the_same_key_is_answered_once(): void
    {
        $first = $this->send($this->draft, 'key-0000-0001')->assertCreated();
        $again = $this->send($this->draft, 'key-0000-0001')->assertCreated()->assertHeader('Idempotent-Replayed', 'true');
        $this->assertSame($first->json('data.id'), $again->json('data.id'));
        $this->assertSame(1, DB::table('vouchers')->count());

        // the same key for something else: refused
        $this->send(['payee_name' => 'Other'] + $this->draft, 'key-0000-0001')->assertStatus(422)->assertJsonPath('code', 'IDEMPOTENCY_KEY_REUSED');
        // a new key = a new request
        $this->send($this->draft, 'key-0000-0002')->assertCreated();
        $this->assertSame(2, DB::table('vouchers')->count());
        // no key (older clients): unchanged behaviour
        $this->send($this->draft, null)->assertCreated();
        $this->assertSame(3, DB::table('vouchers')->count());
    }

    public function test_a_failed_request_can_be_tried_again_with_the_same_key(): void
    {
        $this->send(['payment_method' => 'cash'], 'key-0000-0003')->assertStatus(422);
        $this->assertDatabaseMissing('idempotency_keys', ['key' => 'key-0000-0003']);
        $this->send(['payment_method' => 'cash'], 'key-0000-0003')->assertStatus(422)->assertHeaderMissing('Idempotent-Replayed');
    }

    public function test_still_running_and_bad_keys(): void
    {
        DB::table('idempotency_keys')->insert([
            'user_id' => $this->clerk->id, 'key' => 'key-0000-0004', 'method' => 'POST', 'path' => 'api/v1/vouchers',
            'request_hash' => str_repeat('0', 64), 'status_code' => null, 'expires_at' => now()->addDay(), 'created_at' => now(), 'updated_at' => now(),
        ]);
        $this->send($this->draft, 'key-0000-0004')->assertStatus(422)->assertJsonPath('code', 'IDEMPOTENCY_KEY_REUSED'); // other hash
        $this->send($this->draft, 'bad key!')->assertStatus(400)->assertJsonPath('code', 'IDEMPOTENCY_KEY_INVALID');
    }
}
