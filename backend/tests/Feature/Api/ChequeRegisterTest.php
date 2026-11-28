<?php

namespace Tests\Feature\Api;

use App\Models\Company;
use App\Models\Department;
use App\Models\PayeeType;
use App\Models\User;
use App\Models\VoucherCategory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

/**
 * Cheque register (user decisions 2026-11-29): the clerk records the cheque of an approved cheque voucher and moves it
 * issued → released → cleared (or cancels it); officers and supervisors read the company's register; a daily job
 * reminds 30 days before and marks uncleared cheques stale 180 days after their date.
 * Run:  php artisan test --filter=ChequeRegisterTest
 */
class ChequeRegisterTest extends TestCase
{
    use RefreshDatabase;

    private Company $apex;

    private Company $north;

    private User $clerk;

    private User $otherClerk;

    private User $officer;

    private User $supervisor;

    private int $category;

    private int $dept;

    protected function setUp(): void
    {
        parent::setUp();
        Mail::fake();
        $this->apex = Company::factory()->create(['name' => 'Apex Holdings Inc.']);
        $this->north = Company::factory()->create(['name' => 'Northfield']);
        $this->dept = Department::factory()->for($this->apex)->create(['name' => 'Finance Ops'])->id;
        $this->clerk = User::factory()->create(['company_id' => $this->apex->id]);
        $this->otherClerk = User::factory()->create(['company_id' => $this->apex->id]);
        $this->officer = User::factory()->officer()->create(['company_id' => $this->apex->id]);
        $this->supervisor = User::factory()->supervisor()->create(['company_id' => $this->apex->id]);
        foreach ([$this->clerk, $this->otherClerk, $this->officer, $this->supervisor] as $u) {
            $u->accessibleCompanies()->attach($this->apex->id, ['granted_status' => 'accepted']);
        }
        $this->clerk->accessibleCompanies()->attach($this->north->id, ['granted_status' => 'accepted']);
        $this->category = VoucherCategory::create(['company_id' => $this->apex->id, 'name' => 'Supplies'])->id;
    }

    private function api(string $method, string $uri, array $data = [], ?User $as = null, ?int $company = null)
    {
        return $this->actingAs($as ?? $this->clerk)->json($method, '/api/v1'.$uri, $data, ['X-Company-ID' => (string) ($company ?? $this->apex->id)]);
    }

    /** A voucher by $clerk, approved by Accounting and the Supervisor. */
    private function approved(string $method = 'cheque', ?User $clerk = null): int
    {
        $clerk ??= $this->clerk;
        $id = $this->api('POST', '/vouchers', [
            'category_id' => $this->category, 'payment_method' => $method, 'payee_name' => 'Metro Office Supplies',
            'payee_type_id' => PayeeType::create(['company_id' => $this->apex->id, 'name' => 'Supplier '.uniqid()])->id,
            'department_id' => $this->dept, 'description' => 'Bond paper',
            'line_items' => [['description' => 'Bond paper', 'quantity' => '10', 'unit_price' => '250.00']],
        ], $clerk)->assertCreated()->json('data.id');
        $this->api('POST', "/vouchers/{$id}/submit", [], $clerk)->assertOk();
        $this->api('POST', "/officer/vouchers/{$id}/approve", [], $this->officer)->assertOk();
        $this->travel(5)->minutes();
        $this->api('POST', "/supervisor/vouchers/{$id}/approve", ['remarks' => 'Checked.'], $this->supervisor)->assertOk();

        return $id;
    }

    private function record(int $voucher, array $extra = [], ?User $as = null)
    {
        return $this->api('POST', "/vouchers/{$voucher}/cheques", array_merge([
            'cheque_number' => '0012345', 'cheque_date' => Carbon::today()->toDateString(), 'bank_name' => 'BDO',
        ], $extra), $as);
    }

    public function test_the_clerk_records_a_cheque_and_moves_it_to_cleared(): void
    {
        $id = $this->approved();

        $cheque = $this->record($id, ['cheque_number' => ' 0012345 '])->assertCreated()
            ->assertJsonPath('data.status', 'issued')
            ->assertJsonPath('data.cheque_number', '0012345')
            ->assertJsonPath('data.amount', '2500.00')
            ->assertJsonPath('data.payee_name', 'Metro Office Supplies')
            ->assertJsonPath('data.days_left', 180)
            ->assertJsonPath('data.can.release', true)
            ->assertJsonPath('data.can.clear', false)
            ->json('data.id');

        // clearing before it's released isn't a valid step
        $this->api('POST', "/cheques/{$cheque}/clear", ['cleared_on' => Carbon::today()->toDateString()])
            ->assertStatus(409)->assertJsonPath('code', 'INVALID_CHEQUE_STATUS');

        $this->api('POST', "/cheques/{$cheque}/release", ['received_by' => 'Lito Reyes'])->assertOk()
            ->assertJsonPath('data.status', 'released')->assertJsonPath('data.received_by', 'Lito Reyes');
        $this->api('POST', "/cheques/{$cheque}/clear", ['cleared_on' => Carbon::today()->toDateString()])->assertOk()
            ->assertJsonPath('data.status', 'cleared')->assertJsonPath('data.days_left', null);

        // the payment PDF now prints the cheque instead of blank lines
        $this->api('GET', "/vouchers/{$id}/payment-pdf")->assertOk()->assertHeader('Content-Type', 'application/pdf');

        $this->assertSame(
            ['cheque_recorded', 'cheque_released', 'cheque_cleared'],
            DB::table('audit_logs')->where('table_name', 'cheques')->orderBy('id')->pluck('action')->all(),
        );
    }

    public function test_only_an_approved_cheque_voucher_gets_a_cheque_and_only_one_live_cheque(): void
    {
        $this->record($this->approved('cash'))->assertStatus(409)->assertJsonPath('code', 'NOT_A_CHEQUE_VOUCHER');

        $id = $this->approved();
        $first = $this->record($id)->assertCreated()->json('data.id');
        $this->record($id, ['cheque_number' => '0012346'])->assertStatus(409)->assertJsonPath('code', 'CHEQUE_ALREADY_RECORDED');

        // cancel it (reason required) → a replacement can be recorded, and both stay in the history
        $this->api('POST', "/cheques/{$first}/cancel", [])->assertUnprocessable()->assertJsonValidationErrors(['reason']);
        $this->api('POST', "/cheques/{$first}/cancel", ['reason' => 'Spoiled while writing'])->assertOk()->assertJsonPath('data.status', 'cancelled');
        $this->api('POST', "/cheques/{$first}/release", ['received_by' => 'Lito'])->assertStatus(409);
        $this->record($id, ['cheque_number' => '0012346'])->assertCreated();

        $this->api('GET', "/vouchers/{$id}/cheques")->assertOk()->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.cheque_number', '0012346')->assertJsonPath('data.1.status', 'cancelled');
    }

    public function test_cheque_details_are_checked(): void
    {
        $id = $this->approved();
        $this->record($id, ['cheque_number' => '', 'bank_name' => ''])->assertUnprocessable()
            ->assertJsonValidationErrors(['cheque_number', 'bank_name']);
        $this->record($id, ['cheque_date' => Carbon::today()->subDays(200)->toDateString()])->assertUnprocessable()
            ->assertJsonValidationErrors(['cheque_date']);
        $this->record($id, ['cheque_date' => Carbon::today()->addDays(200)->toDateString()])->assertUnprocessable()
            ->assertJsonValidationErrors(['cheque_date']);

        // a post-dated cheque is fine, but can't be cleared before its date
        $cheque = $this->record($id, ['cheque_date' => Carbon::today()->addDays(10)->toDateString()])->assertCreated()->json('data.id');
        $this->api('POST', "/cheques/{$cheque}/release", ['received_by' => 'Lito Reyes'])->assertOk();
        $this->api('POST', "/cheques/{$cheque}/clear", ['cleared_on' => Carbon::today()->toDateString()])
            ->assertUnprocessable()->assertJsonValidationErrors(['cleared_on']);

        // the same number for the same bank can't be used twice in the company
        $this->record($this->approved())->assertUnprocessable()->assertJsonValidationErrors(['cheque_number']);
        $this->record($this->approved(), ['bank_name' => 'Metrobank'])->assertCreated();
    }

    public function test_the_register_scope_and_who_may_change_cheques(): void
    {
        $mine = $this->record($this->approved())->assertCreated()->json('data.id');
        $this->record($this->approved('cheque', $this->otherClerk), ['cheque_number' => '777'], $this->otherClerk)->assertCreated();

        // a clerk sees their own vouchers' cheques; officers and supervisors see the company, read-only
        $this->api('GET', '/cheques')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('meta.counts.outstanding', 1)
            ->assertJsonPath('meta.outstanding_total', '2500.00');
        $this->api('GET', '/cheques', [], $this->officer)->assertOk()->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.can.release', false);
        $this->api('GET', '/cheques?view=cleared', [], $this->supervisor)->assertOk()->assertJsonCount(0, 'data');
        $this->api('GET', '/cheques?search=777', [], $this->supervisor)->assertOk()->assertJsonCount(1, 'data');
        $this->api('GET', '/cheques?view=nope')->assertUnprocessable();

        $this->api('POST', "/cheques/{$mine}/release", ['received_by' => 'Lito'], $this->officer)->assertForbidden();
        $this->api('POST', "/cheques/{$mine}/release", ['received_by' => 'Lito'], $this->otherClerk)->assertNotFound();
        $this->api('GET', '/cheques', [], null, $this->north->id)->assertOk()->assertJsonCount(0, 'data'); // another company
        $this->api('POST', "/cheques/{$mine}/release", ['received_by' => 'Lito'], null, $this->north->id)->assertNotFound();
        $this->app['auth']->forgetGuards();
        $this->json('GET', '/api/v1/cheques')->assertUnauthorized();
    }

    public function test_the_daily_job_reminds_then_marks_stale(): void
    {
        $id = $this->approved();
        $cheque = $this->record($id, ['cheque_date' => Carbon::today()->subDays(155)->toDateString()])->assertCreated()->json('data.id');

        $this->artisan('cheques:mark-stale')->assertSuccessful();
        $this->assertDatabaseHas('notifications', ['recipient_id' => $this->clerk->id, 'type' => 'cheque_stale', 'voucher_id' => $id]);
        $this->artisan('cheques:mark-stale')->assertSuccessful(); // no second reminder
        $this->assertSame(1, DB::table('notifications')->where('type', 'cheque_stale')->count());
        $this->api('GET', '/cheques')->assertJsonPath('meta.stale_soon', 1);

        $this->travel(26)->days();
        $this->artisan('cheques:mark-stale')->assertSuccessful();
        $this->api('GET', "/vouchers/{$id}/cheques")->assertJsonPath('data.0.status', 'stale');
        $this->assertSame(2, DB::table('notifications')->where('type', 'cheque_stale')->count());
        $this->assertDatabaseHas('audit_logs', ['action' => 'cheque_stale', 'record_id' => $cheque, 'user_id' => null]);

        // stale = a replacement cheque may be recorded
        $this->record($id, ['cheque_number' => '0099999'])->assertCreated();
    }

    public function test_admins_never_see_cheque_activity(): void
    {
        $admin = User::factory()->admin()->create(['company_id' => $this->apex->id]);
        $this->record($this->approved())->assertCreated();

        $actions = collect($this->actingAs($admin)->getJson('/api/v1/admin/audit-logs?range=7d')->assertOk()->json('data'))->pluck('action');
        $this->assertFalse($actions->contains(fn ($a) => str_starts_with((string) $a, 'cheque_')));
    }
}
