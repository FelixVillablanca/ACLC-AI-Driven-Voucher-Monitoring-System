<?php

namespace Tests\Feature\Api;

use App\Models\Company;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Admin accounts page (Framer bxGFPLOVN):  GET /api/v1/superadmin/admins
 *
 * Run:  php artisan test --filter=SuperAdminAdminsListTest
 */
class SuperAdminAdminsListTest extends TestCase
{
    use RefreshDatabase;

    private const URL = '/api/v1/superadmin/admins';

    private User $owner;

    protected function setUp(): void
    {
        parent::setUp();
        $apex = Company::factory()->create(['name' => 'Apex Holdings']);

        $this->owner = User::factory()->superAdmin()->create(['first_name' => 'Felix', 'last_name' => 'V', 'last_login_at' => now()]);
        User::factory()->superAdmin()->create(['first_name' => 'Ana', 'last_name' => 'Cruz', 'last_login_at' => now()->subHours(2)]);
        User::factory()->admin()->create(['first_name' => 'John', 'last_name' => 'Doe', 'email' => 'johndoe@Administrator.com',
            'company_id' => $apex->id, 'last_login_at' => now()->subMinutes(5), 'personal_email' => 'john@gmail.com']);
        User::factory()->admin()->create(['first_name' => 'Liza', 'last_name' => 'Santos', 'last_login_at' => now()->subDay()]);
        User::factory()->admin()->pending()->create(['first_name' => 'Carlo', 'last_name' => 'Reyes', 'last_login_at' => null, 'personal_email' => 'c@gmail.com']);
        User::factory()->admin()->inactive()->create(['first_name' => 'Mark', 'last_name' => 'Tan', 'last_login_at' => now()->subDays(11)]);
        User::factory()->create(['first_name' => 'Maria']); // a clerk: never on this page
    }

    public function test_it_lists_super_admins_then_admins_by_status_with_counts_and_seats(): void
    {
        $this->actingAs($this->owner)->getJson(self::URL)
            ->assertOk()
            ->assertJsonCount(6, 'data')
            ->assertJsonPath('data.0.full_name', 'Felix V')
            ->assertJsonPath('data.0.is_you', true)
            ->assertJsonPath('data.1.full_name', 'Ana Cruz')
            ->assertJsonPath('data.2.full_name', 'John Doe')
            ->assertJsonPath('data.2.company', 'Apex Holdings')
            ->assertJsonPath('data.3.full_name', 'Liza Santos')
            ->assertJsonPath('data.4.status', 'pending')
            ->assertJsonPath('data.5.status', 'inactive')
            ->assertJsonPath('meta.counts', ['all' => 6, 'active' => 4, 'pending' => 1, 'inactive' => 1])
            ->assertJsonPath('meta.total_accounts', 6)
            ->assertJsonPath('meta.super_admin_seats', ['used' => 2, 'total' => 3])
            ->assertJsonPath('meta.total', 6);
    }

    public function test_row_actions_follow_the_account(): void
    {
        $rows = collect($this->actingAs($this->owner)->getJson(self::URL)->json('data'))->keyBy('first_name');

        $this->assertSame(['resend_invitation' => false, 'reset_password' => false, 'lock' => false, 'unlock' => false], $rows['Ana']['actions']);
        $this->assertSame(['resend_invitation' => false, 'reset_password' => true, 'lock' => true, 'unlock' => false], $rows['John']['actions']);
        $this->assertFalse($rows['Liza']['actions']['reset_password']); // no personal email
        $this->assertTrue($rows['Carlo']['actions']['resend_invitation']);
        $this->assertTrue($rows['Mark']['actions']['unlock']);
    }

    public function test_status_role_and_search_filters(): void
    {
        $this->actingAs($this->owner)->getJson(self::URL.'?filter[status]=pending')
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.first_name', 'Carlo')
            ->assertJsonPath('meta.counts.all', 6); // the chips still show every number

        $this->actingAs($this->owner)->getJson(self::URL.'?filter[role]=super_admin')
            ->assertOk()->assertJsonCount(2, 'data')->assertJsonPath('meta.counts', ['all' => 2, 'active' => 2, 'pending' => 0, 'inactive' => 0]);

        $this->actingAs($this->owner)->getJson(self::URL.'?search=liza')->assertOk()->assertJsonCount(1, 'data');
        $this->actingAs($this->owner)->getJson(self::URL.'?search=john doe')->assertOk()->assertJsonCount(1, 'data');
        $this->actingAs($this->owner)->getJson(self::URL.'?search=administrator.com')->assertOk()->assertJsonCount(1, 'data');
        $this->actingAs($this->owner)->getJson(self::URL.'?search=%25')->assertOk()->assertJsonCount(0, 'data'); // "%" is a letter, not "anything"
    }

    public function test_pages_and_bad_filters(): void
    {
        $this->actingAs($this->owner)->getJson(self::URL.'?per_page=4&page=2')
            ->assertOk()->assertJsonCount(2, 'data')->assertJsonPath('meta.current_page', 2)->assertJsonPath('meta.last_page', 2);

        $this->actingAs($this->owner)->getJson(self::URL.'?filter[status]=bogus')->assertStatus(422);
        $this->actingAs($this->owner)->getJson(self::URL.'?per_page=500')->assertStatus(422);
    }

    public function test_only_super_admins_get_in(): void
    {
        $this->getJson(self::URL)->assertUnauthorized();
        $this->actingAs(User::where('first_name', 'John')->first())->getJson(self::URL)->assertForbidden();
    }
}
