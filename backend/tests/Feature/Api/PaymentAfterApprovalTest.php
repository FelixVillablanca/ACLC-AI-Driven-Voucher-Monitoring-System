<?php

namespace Tests\Feature\Api;

use App\Mail\PaymentApprovedMail;
use App\Models\Company;
use App\Models\Department;
use App\Models\PayeeType;
use App\Models\User;
use App\Models\VoucherCategory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

/**
 * After the Supervisor's FINAL approval (user decisions 2026-11-28): every voucher goes Officer → Supervisor; the clerk's
 * final-approval notice offers the payment PDF (cash / bank / cheque layout) and "Email the payee" (the optional payee
 * email on the voucher), which sends the approval with the payee copy of the PDF attached.
 *
 * Run:  php artisan test --filter=PaymentAfterApprovalTest
 */
class PaymentAfterApprovalTest extends TestCase
{
    use RefreshDatabase;

    private Company $apex;

    private User $clerk;

    private User $officer;

    private User $supervisor;

    private int $category;

    private int $dept;

    protected function setUp(): void
    {
        parent::setUp();
        Mail::fake();
        $this->apex = Company::factory()->create(['name' => 'Apex Holdings Inc.']);
        $this->dept = Department::factory()->for($this->apex)->create(['name' => 'Finance Ops'])->id;
        $this->clerk = User::factory()->create(['first_name' => 'Juan', 'last_name' => 'Dela Cruz', 'company_id' => $this->apex->id]);
        $this->officer = User::factory()->officer()->create(['first_name' => 'Maria', 'company_id' => $this->apex->id]);
        $this->supervisor = User::factory()->supervisor()->create(['first_name' => 'Ana', 'company_id' => $this->apex->id]);
        foreach ([$this->clerk, $this->officer, $this->supervisor] as $u) {
            $u->accessibleCompanies()->attach($this->apex->id, ['granted_status' => 'accepted']);
        }
        $this->category = VoucherCategory::create(['company_id' => $this->apex->id, 'name' => 'Transportation'])->id;
    }

    private function api(string $method, string $uri, array $data = [], ?User $as = null)
    {
        return $this->actingAs($as ?? $this->clerk)->json($method, '/api/v1'.$uri, $data, ['X-Company-ID' => (string) $this->apex->id]);
    }

    private function submitted(array $extra = []): int
    {
        $id = $this->api('POST', '/vouchers', array_merge([
            'category_id' => $this->category, 'payment_method' => 'cash', 'payee_name' => 'Metro Office Supplies',
            'payee_type_id' => PayeeType::create(['company_id' => $this->apex->id, 'name' => 'Supplier '.uniqid()])->id,
            'department_id' => $this->dept, 'description' => 'Bond paper',
            'line_items' => [['description' => 'Bond paper', 'quantity' => '10', 'unit_price' => '250.00']],
        ], $extra))->assertCreated()->json('data.id');
        $this->api('POST', "/vouchers/{$id}/submit")->assertOk();

        return $id;
    }

    private function approveBoth(int $id): void
    {
        $this->api('POST', "/officer/vouchers/{$id}/approve", [], $this->officer)->assertOk()->assertJsonPath('data.status', 'under_review');
        $this->travel(5)->minutes(); // two people never decide in the same second
        $this->api('POST', "/supervisor/vouchers/{$id}/approve", ['remarks' => 'Checked the quotation.'], $this->supervisor)->assertOk();
    }

    public function test_the_payee_email_is_saved_and_checked(): void
    {
        $id = $this->submitted(['payee_email' => '  Accounts@Metro.PH ']);
        $this->api('GET', "/vouchers/{$id}")->assertJsonPath('data.payee_email', 'accounts@metro.ph');

        $this->api('POST', '/vouchers', ['category_id' => $this->category, 'payment_method' => 'cash', 'payee_email' => 'nope'])
            ->assertUnprocessable()->assertJsonValidationErrors(['payee_email']);
    }

    public function test_after_the_final_approval_the_notice_offers_the_pdf_and_email(): void
    {
        $id = $this->submitted(['payee_email' => 'accounts@metro.ph']);

        // before the final approval: no payment PDF yet
        $this->api('GET', "/vouchers/{$id}/payment-pdf")->assertStatus(409)->assertJsonPath('code', 'VOUCHER_NOT_APPROVED');

        $this->approveBoth($id);

        $notes = collect($this->api('GET', '/notifications')->assertOk()->json('data'))->where('voucher_id', $id);
        $final = $notes->firstWhere('title', DB::table('vouchers')->where('id', $id)->value('voucher_number').' was approved');
        $this->assertSame(['payment_pdf', 'email_payee'], $final['actions']);
        // the earlier "passed Accounting" notice has no buttons
        $this->assertSame([], $notes->first(fn ($n) => str_contains($n['title'], 'passed Accounting'))['actions']);

        $this->api('GET', "/vouchers/{$id}/payment-pdf")->assertOk()->assertHeader('Content-Type', 'application/pdf');
    }

    public function test_email_the_payee_sends_the_pdf_and_is_audited(): void
    {
        $id = $this->submitted(['payment_method' => 'bank', 'payee_email' => 'accounts@metro.ph',
            'bank_name' => 'BDO', 'bank_account_number' => '001234567890', 'bank_account_name' => 'Metro Office Supplies']);
        $this->approveBoth($id);

        $this->api('POST', "/vouchers/{$id}/email-payee", ['note' => 'Expect it on Friday.'])
            ->assertOk()->assertJsonPath('data.sent_to', 'accounts@metro.ph');

        Mail::assertSent(PaymentApprovedMail::class, fn (PaymentApprovedMail $m) => $m->hasTo('accounts@metro.ph')
            && $m->note === 'Expect it on Friday.' && str_ends_with($m->pdfName, '-payment.pdf') && str_starts_with($m->pdf, '%PDF'));
        $this->assertDatabaseHas('audit_logs', ['action' => 'payee_emailed', 'record_id' => $id, 'user_id' => $this->clerk->id]);
    }

    public function test_email_is_refused_without_an_email_or_before_approval_and_only_for_the_owner(): void
    {
        $noEmail = $this->submitted();
        $this->approveBoth($noEmail);
        $this->api('POST', "/vouchers/{$noEmail}/email-payee")->assertStatus(409)->assertJsonPath('code', 'NO_PAYEE_EMAIL');
        $this->api('GET', "/vouchers/{$noEmail}/payment-pdf")->assertOk(); // the PDF still works

        $waiting = $this->submitted(['payee_email' => 'a@b.ph']);
        $this->api('POST', "/vouchers/{$waiting}/email-payee")->assertStatus(409)->assertJsonPath('code', 'VOUCHER_NOT_APPROVED');

        $other = User::factory()->create(['company_id' => $this->apex->id]);
        $other->accessibleCompanies()->attach($this->apex->id, ['granted_status' => 'accepted']);
        $this->api('POST', "/vouchers/{$noEmail}/email-payee", [], $other)->assertNotFound();
        $this->api('GET', "/vouchers/{$noEmail}/payment-pdf", [], $this->officer)->assertForbidden();

        Mail::assertNotSent(PaymentApprovedMail::class);
    }

    public function test_cheque_and_cash_pdfs_render(): void
    {
        foreach (['cheque', 'cash'] as $method) {
            $id = $this->submitted(['payment_method' => $method]);
            $this->approveBoth($id);
            $pdf = $this->api('GET', "/vouchers/{$id}/payment-pdf")->assertOk()->getContent();
            $this->assertStringStartsWith('%PDF', $pdf);
        }
    }
}
