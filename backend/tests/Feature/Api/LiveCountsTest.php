<?php

namespace Tests\Feature\Api;

use App\Models\Company;
use App\Models\Department;
use App\Models\Notification;
use App\Models\PayeeType;
use App\Models\User;
use App\Models\VoucherCategory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

/**
 * Phase 7 Step 2 (2026-11-28): the 30-second cache of the numbers every tab polls (App\Support\LiveCounts).
 * A cached answer is reused while nothing changed, and a real change shows on the very next request.
 * Run:  php artisan test --filter=LiveCountsTest
 */
class LiveCountsTest extends TestCase
{
    use RefreshDatabase;

    private Company $apex;

    private Company $north;

    private User $clerk;

    private User $officer;

    private int $category;

    private int $payeeType;

    private int $dept;

    protected function setUp(): void
    {
        parent::setUp();
        Mail::fake();
        $this->apex = Company::factory()->create(['name' => 'Apex Holdings Inc.']);
        $this->north = Company::factory()->create(['name' => 'Northfield']);
        $this->dept = Department::factory()->for($this->apex)->create(['name' => 'Finance Ops'])->id;
        $this->clerk = User::factory()->create(['company_id' => $this->apex->id]);
        $this->officer = User::factory()->officer()->create(['company_id' => $this->apex->id]);
        foreach ([$this->clerk, $this->officer] as $u) {
            $u->accessibleCompanies()->attach($this->apex->id, ['granted_status' => 'accepted']);
        }
        $this->officer->accessibleCompanies()->attach($this->north->id, ['granted_status' => 'accepted']);
        $this->category = VoucherCategory::create(['company_id' => $this->apex->id, 'name' => 'Transportation'])->id;
        $this->payeeType = PayeeType::create(['company_id' => $this->apex->id, 'name' => 'Supplier'])->id;
    }

    private function api(string $method, string $uri, array $data = [], ?User $as = null, ?int $company = null)
    {
        return $this->actingAs($as ?? $this->officer)->json($method, '/api/v1'.$uri, $data, ['X-Company-ID' => (string) ($company ?? $this->apex->id)]);
    }

    private function submitted(string $amount): int
    {
        $id = $this->api('POST', '/vouchers', [
            'category_id' => $this->category, 'payment_method' => 'cash', 'payee_name' => 'Grab for Business',
            'payee_type_id' => $this->payeeType, 'department_id' => $this->dept, 'description' => 'Rides',
            'line_items' => [['description' => 'Trips', 'quantity' => '1', 'unit_price' => $amount]],
        ], $this->clerk)->assertCreated()->json('data.id');
        $this->api('POST', "/vouchers/{$id}/submit", [], $this->clerk)->assertOk();

        return $id;
    }

    public function test_a_cached_answer_is_reused_while_nothing_changed(): void
    {
        $this->submitted('1000.00');
        $this->api('GET', '/officer/summary')->assertOk()->assertJsonPath('data.queue.total', 1);

        // A write that skips the app entirely (no request, no model event): the cache doesn't know yet
        DB::table('vouchers')->update(['status' => 'draft']);

        $this->api('GET', '/officer/summary')->assertOk()->assertJsonPath('data.queue.total', 1);
    }

    public function test_a_change_through_the_app_shows_on_the_next_request(): void
    {
        $this->submitted('1000.00');
        $this->api('GET', '/officer/summary')->assertJsonPath('data.queue.total', 1);
        $this->api('GET', '/officer/dashboard')->assertJsonPath('data.queue.total', 1);
        $this->api('GET', '/clerk/dashboard', [], $this->clerk)->assertJsonPath('data.counts.with_officer', 1);

        $this->submitted('2000.00'); // write requests through the `company` middleware + Voucher model events

        $this->api('GET', '/officer/summary')->assertJsonPath('data.queue.total', 2);
        $this->api('GET', '/officer/dashboard')->assertJsonPath('data.queue.total', 2);
        $this->api('GET', '/clerk/dashboard', [], $this->clerk)->assertJsonPath('data.counts.with_officer', 2);
    }

    public function test_numbers_are_kept_per_company(): void
    {
        $this->submitted('1000.00');

        $this->api('GET', '/officer/summary')->assertJsonPath('data.queue.total', 1);
        $this->api('GET', '/officer/summary', [], null, $this->north->id)->assertJsonPath('data.queue.total', 0);
    }

    public function test_the_bell_count_follows_new_and_read_notifications(): void
    {
        $this->api('GET', '/notifications/unread-count')->assertJsonPath('data.unread_count', 0);

        $n = Notification::create(['recipient_id' => $this->officer->id, 'type' => 'voucher_pending', 'title' => 'New', 'message' => 'x']);
        $this->api('GET', '/notifications/unread-count')->assertJsonPath('data.unread_count', 1);

        $this->api('POST', "/notifications/{$n->id}/read")->assertNoContent();
        $this->api('GET', '/notifications/unread-count')->assertJsonPath('data.unread_count', 0);

        Notification::create(['recipient_id' => $this->officer->id, 'type' => 'voucher_pending', 'title' => 'A', 'message' => 'x']);
        Notification::create(['recipient_id' => $this->officer->id, 'type' => 'voucher_pending', 'title' => 'B', 'message' => 'x']);
        $this->api('GET', '/notifications/unread-count')->assertJsonPath('data.unread_count', 2);

        $this->api('POST', '/notifications/read-all')->assertNoContent(); // a mass update: cleared by hand
        $this->api('GET', '/notifications/unread-count')->assertJsonPath('data.unread_count', 0);
    }
}
