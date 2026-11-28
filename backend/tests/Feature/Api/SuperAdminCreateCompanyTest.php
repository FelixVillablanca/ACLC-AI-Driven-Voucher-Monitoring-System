<?php

namespace Tests\Feature\Api;

use App\Domain\Tenancy\Actions\CreateCompany;
use App\Models\Company;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

/**
 * POST /api/v1/superadmin/companies ("+ Add company"), and the new company showing up
 * in the Add admin "Company" select (GET /superadmin/admins/form-defaults).
 *
 * Run:  php artisan test --filter=SuperAdminCreateCompanyTest
 */
class SuperAdminCreateCompanyTest extends TestCase
{
    use RefreshDatabase;

    private const URL = '/api/v1/superadmin/companies';

    private User $owner;

    protected function setUp(): void
    {
        parent::setUp();
        $this->owner = User::factory()->superAdmin()->create(['first_name' => 'Felix', 'last_name' => 'V']);
    }

    public function test_super_admin_adds_a_company_and_it_is_audited_and_announced(): void
    {
        $other = User::factory()->superAdmin()->create();

        $this->actingAs($this->owner)
            ->postJson(self::URL, [
                'name' => '  Bayview   Logistics Corp. ',
                'type' => 'corporate',
                'address' => 'Pasig City',
                'contact_email' => 'Finance@Bayview.ph',
                'contact_phone' => '+63 2 8123 4567',
                'tin_number' => '123-456-789-000',
                'fiscal_year_start' => '2027-01-01',
            ])
            ->assertCreated()
            ->assertJsonPath('data.name', 'Bayview Logistics Corp.')
            ->assertJsonPath('data.status', 'active')
            ->assertJsonPath('data.users_count', 0);

        $company = Company::where('name', 'Bayview Logistics Corp.')->firstOrFail();
        $this->assertTrue((bool) $company->is_active);
        $this->assertSame('finance@bayview.ph', $company->contact_email);

        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $this->owner->id, 'action' => 'company_created', 'table_name' => 'companies', 'record_id' => $company->id,
        ]);
        $this->assertDatabaseHas('notifications', ['recipient_id' => $other->id, 'type' => 'company_changed', 'title' => 'Company added']);
        $this->assertDatabaseMissing('notifications', ['recipient_id' => $this->owner->id, 'title' => 'Company added']);
    }

    public function test_the_new_company_appears_in_the_add_admin_company_select(): void
    {
        $id = $this->actingAs($this->owner)
            ->postJson(self::URL, ['name' => 'Greenline Foods', 'type' => 'corporate'])
            ->assertCreated()
            ->json('data.id');

        $this->actingAs($this->owner)
            ->getJson('/api/v1/superadmin/admins/form-defaults')
            ->assertOk()
            ->assertJsonFragment(['id' => $id, 'name' => 'Greenline Foods', 'admins_count' => 0]);

        // and an Admin can be created for it straight away
        $this->actingAs($this->owner)
            ->postJson('/api/v1/superadmin/admins', [
                'first_name' => 'Rhea', 'last_name' => 'Valdez', 'email_username' => 'rheavaldez',
                'personal_email' => 'rhea@gmail.com', 'company_id' => $id,
            ])
            ->assertCreated()
            ->assertJsonPath('data.company.id', $id);
    }

    public function test_duplicate_name_ignoring_letter_case_is_422(): void
    {
        Company::factory()->create(['name' => 'Apex Holdings Inc.']);

        $this->actingAs($this->owner)
            ->postJson(self::URL, ['name' => 'APEX holdings inc.', 'type' => 'corporate'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['name' => 'A company with this name already exists.']);
    }

    public function test_the_database_refuses_a_duplicate_name_even_if_the_form_check_is_skipped(): void
    {
        Company::factory()->create(['name' => 'Apex Holdings Inc.']);

        // e.g. two "Add company" clicks at the same moment: both passed the form check
        $this->expectException(ValidationException::class);
        app(CreateCompany::class)->handle(['name' => 'apex holdings inc.', 'type' => 'corporate'], $this->owner, '127.0.0.1');
    }

    public function test_missing_or_bad_fields_are_422(): void
    {
        $this->actingAs($this->owner)
            ->postJson(self::URL, ['name' => '', 'type' => 'bank', 'contact_email' => 'nope', 'tin_number' => 'ABC'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['name', 'type', 'contact_email', 'tin_number']);

        $this->assertSame(0, Company::count());
    }

    public function test_the_map_pin_is_saved_and_shown_in_the_company_panel(): void
    {
        $id = $this->actingAs($this->owner)
            ->postJson(self::URL, [
                'name' => 'Bayview Logistics Corp.', 'type' => 'corporate',
                'address' => 'Ortigas Center, Pasig City', 'latitude' => 14.5869791, 'longitude' => 121.0614106,
                'place_id' => 'way/123456',
            ])
            ->assertCreated()
            ->json('data.id');

        $this->assertDatabaseHas('companies', ['id' => $id, 'latitude' => '14.5869791', 'longitude' => '121.0614106', 'place_id' => 'way/123456']);

        $this->actingAs($this->owner)->getJson(self::URL."/{$id}")
            ->assertOk()
            ->assertJsonPath('data.location', ['latitude' => '14.5869791', 'longitude' => '121.0614106', 'place_id' => 'way/123456']);
    }

    public function test_a_pin_dropped_by_hand_needs_no_place_id_and_no_pin_means_no_location(): void
    {
        $hand = $this->actingAs($this->owner)
            ->postJson(self::URL, ['name' => 'Greenline Foods', 'type' => 'corporate', 'latitude' => 10.3157, 'longitude' => 123.8854])
            ->assertCreated()->json('data.id');
        $this->assertDatabaseHas('companies', ['id' => $hand, 'place_id' => null]);

        // a place ID without a pin is dropped
        $none = $this->actingAs($this->owner)
            ->postJson(self::URL, ['name' => 'Northfield Academy', 'type' => 'school', 'place_id' => 'ChIJabc'])
            ->assertCreated()->json('data.id');
        $this->assertDatabaseHas('companies', ['id' => $none, 'latitude' => null, 'place_id' => null]);
        $this->actingAs($this->owner)->getJson(self::URL."/{$none}")->assertJsonPath('data.location', null);
    }

    public function test_half_a_pin_or_impossible_coordinates_are_422(): void
    {
        $this->actingAs($this->owner)
            ->postJson(self::URL, ['name' => 'A Corp', 'type' => 'other', 'latitude' => 14.5])
            ->assertUnprocessable()->assertJsonValidationErrors(['longitude']);

        $this->actingAs($this->owner)
            ->postJson(self::URL, ['name' => 'A Corp', 'type' => 'other', 'latitude' => 95, 'longitude' => 200, 'place_id' => 'bad id!'])
            ->assertUnprocessable()->assertJsonValidationErrors(['latitude', 'longitude', 'place_id']);

        $this->assertSame(0, Company::count());
    }

    public function test_guest_is_401_and_admins_are_403(): void
    {
        $this->postJson(self::URL, ['name' => 'X Corp', 'type' => 'other'])->assertUnauthorized();

        $admin = User::factory()->admin()->create(['company_id' => Company::factory()->create()->id]);
        $this->actingAs($admin)->postJson(self::URL, ['name' => 'X Corp', 'type' => 'other'])->assertForbidden();

        $this->assertDatabaseMissing('companies', ['name' => 'X Corp']);
    }
}
