<?php

namespace Tests\Feature\Api;

use App\Mail\SupportRequestMail;
use App\Models\Company;
use App\Models\User;
use App\Models\VoucherCategory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

/**
 * Help & guides → Contact support (2026-11-26, Framer mudjUlcnp): the message goes to the Admin(s) of the
 * company the clerk is working in, as a bell notice + an email (screenshot attached, never stored).
 * Run:  php artisan test --filter=SupportMessagesTest
 */
class SupportMessagesTest extends TestCase
{
    use RefreshDatabase;

    private Company $apex;

    private Company $north;

    private User $clerk;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        Mail::fake();
        $this->apex = Company::factory()->create(['name' => 'Apex Holdings Inc.']);
        $this->north = Company::factory()->create(['name' => 'Northfield']);
        $this->clerk = User::factory()->create(['first_name' => 'Maria', 'last_name' => 'Lopez', 'company_id' => $this->apex->id]);
        $this->clerk->accessibleCompanies()->attach([$this->apex->id => ['granted_status' => 'accepted'], $this->north->id => ['granted_status' => 'accepted']]);
        $this->admin = User::factory()->admin()->create(['first_name' => 'John', 'last_name' => 'Doe', 'company_id' => $this->apex->id, 'personal_email' => 'john@gmail.test']);
    }

    private function api(string $method, string $uri, array $data = [], ?User $as = null, ?int $company = null)
    {
        return $this->actingAs($as ?? $this->clerk)->json($method, '/api/v1'.$uri, $data, ['X-Company-ID' => (string) ($company ?? $this->apex->id)]);
    }

    public function test_contacts_are_the_companys_admins(): void
    {
        $this->api('GET', '/support/contacts')->assertOk()
            ->assertJsonPath('data.company', 'Apex Holdings Inc.')
            ->assertJsonPath('data.admins.0.name', 'John Doe')
            ->assertJsonMissingPath('data.admins.0.personal_email');
        $this->api('GET', '/support/contacts', company: $this->north->id)->assertOk()->assertJsonCount(0, 'data.admins');
    }

    public function test_a_message_reaches_the_admin_by_bell_and_email_with_the_screenshot(): void
    {
        $category = VoucherCategory::create(['company_id' => $this->apex->id, 'name' => 'Utilities'])->id;
        $voucher = $this->api('POST', '/vouchers', ['category_id' => $category, 'payment_method' => 'cash', 'line_items' => []])->json('data.id');

        $this->api('POST', '/support/messages', [
            'topic' => 'voucher',
            'message' => 'I can’t split this voucher into two. Can you help?',
            'voucher_id' => $voucher,
            'screenshot' => UploadedFile::fake()->image('shot.png', 400, 300),
        ])->assertCreated()->assertJsonPath('data.admins', 1)->assertJsonPath('data.emailed', 1);

        $this->assertDatabaseHas('notifications', [
            'recipient_id' => $this->admin->id, 'type' => 'support_request', 'voucher_id' => null,
            'title' => 'Support request from Maria Lopez: Problem with a voucher',
        ]);
        $this->assertDatabaseHas('audit_logs', ['action' => 'support_request_sent', 'user_id' => $this->clerk->id]);
        Mail::assertSent(SupportRequestMail::class, fn ($m) => $m->hasTo('john@gmail.test') && $m->screenshot !== null && $m->voucherNumber === 'a draft');
    }

    public function test_validation_and_no_admin(): void
    {
        $this->api('POST', '/support/messages', ['topic' => 'nope', 'message' => 'short'])->assertStatus(422)
            ->assertJsonValidationErrors(['topic', 'message']);

        // a voucher of another clerk is refused
        $other = User::factory()->create(['company_id' => $this->apex->id]);
        $other->accessibleCompanies()->attach($this->apex->id, ['granted_status' => 'accepted']);
        $category = VoucherCategory::create(['company_id' => $this->apex->id, 'name' => 'Utilities'])->id;
        $theirs = $this->api('POST', '/vouchers', ['category_id' => $category, 'payment_method' => 'cash', 'line_items' => []], $other)->json('data.id');
        $this->api('POST', '/support/messages', ['topic' => 'voucher', 'message' => 'Please help me with it', 'voucher_id' => $theirs])
            ->assertStatus(422)->assertJsonValidationErrors('voucher_id');

        $this->api('POST', '/support/messages', [
            'topic' => 'other', 'message' => 'Please help me with it', 'screenshot' => UploadedFile::fake()->create('notes.pdf', 10, 'application/pdf'),
        ])->assertStatus(422)->assertJsonValidationErrors('screenshot');

        // Northfield has no Admin
        $this->api('POST', '/support/messages', ['topic' => 'other', 'message' => 'Please help me with it'], company: $this->north->id)
            ->assertStatus(409)->assertJsonPath('code', 'NO_SUPPORT_CONTACT');
        Mail::assertNothingSent();
    }

    public function test_who_may_send(): void
    {
        $this->api('POST', '/support/messages', ['topic' => 'other', 'message' => 'Please help me with it'], $this->admin)->assertForbidden();

        $stranger = User::factory()->create(['company_id' => $this->north->id]);
        $stranger->accessibleCompanies()->attach($this->north->id, ['granted_status' => 'accepted']);
        $this->api('GET', '/support/contacts', as: $stranger)->assertForbidden(); // no access to Apex

        auth()->forgetGuards();
        $this->json('GET', '/api/v1/support/contacts', [], ['X-Company-ID' => (string) $this->apex->id])->assertUnauthorized();
    }

    public function test_an_officer_gets_reviewer_topics_and_may_name_any_submitted_voucher(): void
    {
        $officer = User::factory()->officer()->create(['company_id' => $this->apex->id]);
        $officer->accessibleCompanies()->attach($this->apex->id, ['granted_status' => 'accepted']);
        $category = VoucherCategory::create(['company_id' => $this->apex->id, 'name' => 'Travel'])->id;
        $row = fn (string $status, string $number) => DB::table('vouchers')->insertGetId([
            'voucher_number' => $number, 'company_id' => $this->apex->id, 'created_by' => $this->clerk->id, 'category_id' => $category,
            'payment_method' => 'cash', 'amount' => '100.00', 'status' => $status, 'created_at' => now(), 'updated_at' => now(),
        ]);
        $submitted = $row('pending', 'ML-2026-0001');
        $draft = $row('draft', 'DRAFT-1');

        $this->api('GET', '/support/contacts', [], $officer)->assertOk()
            ->assertJsonFragment(['key' => 'budgets', 'label' => 'Budget allocation issue'])
            ->assertJsonMissing(['key' => 'payees']);

        $this->api('POST', '/support/messages', ['topic' => 'budgets', 'message' => 'The IT budget shows the old total.', 'voucher_id' => $draft], $officer)
            ->assertStatus(422)->assertJsonValidationErrors(['voucher_id']);
        $this->api('POST', '/support/messages', ['topic' => 'budgets', 'message' => 'The IT budget shows the old total.', 'voucher_id' => $submitted], $officer)
            ->assertCreated();
        $this->api('POST', '/support/messages', ['topic' => 'payees', 'message' => 'Clerk-only topic from an officer.'], $officer)
            ->assertStatus(422)->assertJsonValidationErrors(['topic']);
    }
}
