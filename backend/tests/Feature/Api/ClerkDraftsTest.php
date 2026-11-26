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
 * The Drafts page (Framer Xfr2PEq2q / nxFtnDIl1 / EfNUcqRK0): what the cards show (completeness, expiry,
 * total), deleting drafts (one, several, all-or-nothing, conflict check, tenancy) and the nightly clean-up.
 *
 * Run:  php artisan test --filter=ClerkDraftsTest
 */
class ClerkDraftsTest extends TestCase
{
    use RefreshDatabase;

    private Company $apex;

    private User $clerk;

    private int $category;

    private int $payeeType;

    protected function setUp(): void
    {
        parent::setUp();
        $this->apex = Company::factory()->create(['name' => 'Apex Holdings Inc.']);
        $this->clerk = User::factory()->create(['first_name' => 'Maria', 'last_name' => 'Lopez', 'company_id' => $this->apex->id]);
        $this->clerk->accessibleCompanies()->attach($this->apex->id, ['granted_status' => 'accepted']);
        $this->category = VoucherCategory::create(['company_id' => $this->apex->id, 'name' => 'Training'])->id;
        $this->payeeType = PayeeType::create(['company_id' => $this->apex->id, 'name' => 'Supplier'])->id;
    }

    private function api(string $method, string $uri, array $data = [], ?User $as = null)
    {
        return $this->actingAs($as ?? $this->clerk)->json($method, '/api/v1'.$uri, $data, ['X-Company-ID' => (string) $this->apex->id]);
    }

    private function draft(array $values = []): int
    {
        return $this->api('POST', '/vouchers', array_merge(['category_id' => $this->category, 'payment_method' => 'cash', 'line_items' => []], $values))
            ->assertCreated()->json('data.id');
    }

    private function age(int $id, int $days): void
    {
        DB::table('vouchers')->where('id', $id)->update(['updated_at' => now()->subDays($days)]);
    }

    public function test_cards_show_completeness_expiry_and_the_total(): void
    {
        $this->draft([
            'payee_name' => 'National Book Store', 'payee_type_id' => $this->payeeType, 'description' => 'Training materials',
            'line_items' => [['description' => 'Books', 'quantity' => '3', 'unit_price' => '1460.00']],
        ]);
        $empty = $this->draft(['payment_method' => 'bank']);
        $this->age($empty, 28);

        $res = $this->api('GET', '/vouchers?filter[view]=draft')->assertOk()
            ->assertJsonPath('meta.total_amount', '4380.00')
            ->assertJsonPath('meta.counts.draft', 2);

        $cards = collect($res->json('data'))->keyBy('id');
        $this->assertSame(['done' => 4, 'total' => 4, 'missing' => []], $cards->except($empty)->first()['completeness']);
        $this->assertSame(['done' => 0, 'total' => 4, 'missing' => ['payee', 'details', 'bank details', 'lines']], $cards[$empty]['completeness']);
        $this->assertTrue(now()->addDays(2)->isSameDay($cards[$empty]['expires_at']));
        $this->assertSame('Training materials', $cards->except($empty)->first()['summary']);
        $this->assertSame(1, $cards->except($empty)->first()['line_count']);
    }

    public function test_delete_one_draft_for_good_with_an_audit_row(): void
    {
        $id = $this->draft(['payee_name' => 'Ace Hardware', 'line_items' => [['description' => 'Paint', 'quantity' => '2', 'unit_price' => '10825.00']]]);
        $stamp = $this->api('GET', "/vouchers/{$id}")->json('data.updated_at');

        $this->api('DELETE', "/vouchers/{$id}", ['updated_at' => $stamp])->assertNoContent();

        $this->assertDatabaseMissing('vouchers', ['id' => $id]);
        $this->assertDatabaseMissing('voucher_line_items', ['voucher_id' => $id]);
        $this->assertDatabaseHas('audit_logs', ['action' => 'voucher_draft_deleted', 'record_id' => $id, 'user_id' => $this->clerk->id]);
        $this->api('GET', "/vouchers/{$id}")->assertNotFound();
    }

    public function test_delete_refuses_a_stale_screen_and_anything_not_a_draft(): void
    {
        $id = $this->draft();
        $this->api('DELETE', "/vouchers/{$id}", ['updated_at' => '2020-01-01T00:00:00+08:00'])
            ->assertStatus(409)->assertJsonPath('code', 'VOUCHER_CHANGED');

        $sent = $this->draft(['payee_name' => 'PLDT', 'payee_type_id' => $this->payeeType, 'description' => 'Bill',
            'line_items' => [['description' => 'Fibr', 'quantity' => '1', 'unit_price' => '1999.00']]]);
        $this->api('POST', "/vouchers/{$sent}/submit")->assertOk();
        $this->api('DELETE', "/vouchers/{$sent}")->assertStatus(409)->assertJsonPath('code', 'DRAFT_NOT_DELETABLE');
        $this->assertDatabaseHas('vouchers', ['id' => $sent]);
        $this->assertDatabaseHas('vouchers', ['id' => $id]);
    }

    public function test_delete_several_is_all_or_nothing(): void
    {
        [$a, $b, $c] = [$this->draft(), $this->draft(), $this->draft()];
        $this->api('POST', "/vouchers/{$c}/cancel")->assertOk();

        $this->api('POST', '/vouchers/drafts/delete', ['ids' => [$a, $b, $c]])->assertStatus(409)->assertJsonPath('code', 'DRAFT_NOT_DELETABLE');
        $this->assertDatabaseCount('vouchers', 3);

        $this->api('POST', '/vouchers/drafts/delete', ['ids' => [$a, $b]])->assertOk()->assertJsonPath('data.deleted', 2);
        $this->assertDatabaseCount('vouchers', 1);

        $this->api('POST', '/vouchers/drafts/delete', ['ids' => []])->assertUnprocessable()->assertJsonValidationErrors('ids');
    }

    public function test_another_clerks_draft_is_404_and_others_cannot_delete(): void
    {
        $other = User::factory()->create(['company_id' => $this->apex->id]);
        $other->accessibleCompanies()->attach($this->apex->id, ['granted_status' => 'accepted']);
        $theirs = $this->draft();

        $this->api('DELETE', "/vouchers/{$theirs}", [], $other)->assertNotFound();
        $this->api('POST', '/vouchers/drafts/delete', ['ids' => [$theirs]], $other)->assertNotFound();
        $this->assertDatabaseHas('vouchers', ['id' => $theirs]);

        $officer = User::factory()->officer()->create(['company_id' => $this->apex->id]);
        $officer->accessibleCompanies()->attach($this->apex->id, ['granted_status' => 'accepted']);
        $this->api('DELETE', "/vouchers/{$theirs}", [], $officer)->assertForbidden();

        auth()->forgetGuards();
        $this->json('DELETE', "/api/v1/vouchers/{$theirs}")->assertUnauthorized();
    }

    public function test_nightly_cleanup_reminds_once_then_deletes_after_30_days(): void
    {
        $soon = $this->draft(['payee_name' => 'Venue Co.']);
        $old = $this->draft();
        $fresh = $this->draft();
        $returnedish = $this->draft(['payee_name' => 'PLDT', 'payee_type_id' => $this->payeeType, 'description' => 'Bill',
            'line_items' => [['description' => 'Fibr', 'quantity' => '1', 'unit_price' => '1999.00']]]);
        $this->api('POST', "/vouchers/{$returnedish}/submit")->assertOk();
        $this->age($soon, 28);
        $this->age($old, 31);
        $this->age($returnedish, 90); // submitted: never expires

        $this->artisan('vouchers:prune-drafts')->assertSuccessful();

        $this->assertDatabaseMissing('vouchers', ['id' => $old]);
        $this->assertDatabaseHas('vouchers', ['id' => $soon]);
        $this->assertDatabaseHas('vouchers', ['id' => $fresh]);
        $this->assertDatabaseHas('vouchers', ['id' => $returnedish]);
        $this->assertDatabaseHas('audit_logs', ['action' => 'voucher_draft_expired', 'record_id' => $old, 'user_id' => null]);
        $this->assertDatabaseHas('notifications', ['recipient_id' => $this->clerk->id, 'type' => 'draft_expiry', 'voucher_id' => $soon]);
        $this->assertDatabaseHas('notifications', ['recipient_id' => $this->clerk->id, 'type' => 'draft_expiry', 'title' => 'An old draft was deleted']);

        // the next night: no second reminder for the same version
        $this->artisan('vouchers:prune-drafts')->assertSuccessful();
        $this->assertSame(1, DB::table('notifications')->where('voucher_id', $soon)->count());
    }
}
