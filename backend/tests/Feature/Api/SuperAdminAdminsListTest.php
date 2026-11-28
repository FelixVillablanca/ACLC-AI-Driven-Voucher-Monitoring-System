<?php

namespace Tests\Feature\Api;

use App\Models\Company;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Admins tab list (Framer U7glXUOSF + A3 search, A4 sort, A5 pending view):
 *   GET /api/v1/superadmin/admins?filter[view]=…&search=…&sort=…&order=…
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

        $this->owner = User::factory()->superAdmin()->create(['first_name' => 'Felix', 'last_name' => 'V', 'last_login_at' => now(), 'two_factor_confirmed_at' => now(), 'two_factor_secret' => 'X']);
        User::factory()->superAdmin()->create(['first_name' => 'Ana', 'last_name' => 'Cruz', 'last_login_at' => now()->subHours(2), 'two_factor_confirmed_at' => now(), 'two_factor_secret' => 'X']);
        User::factory()->admin()->create(['first_name' => 'John', 'last_name' => 'Doe', 'email' => 'johndoe@Administrator.com',
            'company_id' => $apex->id, 'last_login_at' => now()->subMinutes(5), 'personal_email' => 'john@gmail.com']);
        User::factory()->admin()->create(['first_name' => 'Liza', 'last_name' => 'Santos', 'last_login_at' => now()->subDay(), 'two_factor_confirmed_at' => now(), 'two_factor_secret' => 'X']);
        User::factory()->admin()->pending()->create(['first_name' => 'Carlo', 'last_name' => 'Reyes', 'last_login_at' => null, 'personal_email' => 'c@gmail.com']);
        User::factory()->admin()->inactive()->create(['first_name' => 'Mark', 'last_name' => 'Tan', 'company_id' => $apex->id, 'last_login_at' => now()->subDays(11)]); // has a company, so it can be reactivated
        User::factory()->create(['first_name' => 'Maria']); // a clerk: never on this page
    }

    private function names($response): array
    {
        return array_column($response->json('data'), 'first_name');
    }

    public function test_the_list_sorted_by_last_sign_in_with_view_counts_and_summary_cards(): void
    {
        $response = $this->actingAs($this->owner)->getJson(self::URL)
            ->assertOk()
            ->assertJsonPath('data.0.is_you', true)
            ->assertJsonPath('data.1.company', 'Apex Holdings')
            ->assertJsonPath('meta.views', ['all' => 6, 'super_admins' => 2, 'admins' => 4, 'pending' => 1, 'inactive' => 1])
            ->assertJsonPath('meta.summary.total_accounts', 6)
            ->assertJsonPath('meta.summary.super_admin_seats', ['used' => 2, 'total' => 3])
            ->assertJsonPath('meta.summary.two_factor', ['on' => 3, 'of' => 5]) // Carlo (pending) doesn't count
            ->assertJsonPath('meta.summary.needs_attention', 2); // Carlo (pending) + John (two-step off); Mark is inactive

        // Newest sign-in first; never signed in last
        $this->assertSame(['Felix', 'John', 'Ana', 'Liza', 'Mark', 'Carlo'], $this->names($response));
    }

    public function test_two_step_column_and_row_actions(): void
    {
        $rows = collect($this->actingAs($this->owner)->getJson(self::URL)->json('data'))->keyBy('first_name');

        $this->assertSame('on', $rows['Ana']['two_factor']);
        $this->assertSame('off', $rows['John']['two_factor']);
        $this->assertSame('not_set_up', $rows['Carlo']['two_factor']);

        $this->assertFalse($rows['Felix']['actions']['deactivate']); // yourself
        $this->assertTrue($rows['Ana']['actions']['deactivate']);    // another Super Admin (not the last)
        $this->assertTrue($rows['John']['actions']['reset_password']);
        $this->assertTrue($rows['John']['actions']['require_two_factor']);
        $this->assertTrue($rows['John']['actions']['make_super_admin']); // a seat is free (checklist comes later)
        $this->assertFalse($rows['Liza']['actions']['reset_password']); // no personal email
        $this->assertTrue($rows['Carlo']['actions']['resend_invitation']);
        $this->assertTrue($rows['Carlo']['actions']['cancel_invitation']);
        $this->assertTrue($rows['Mark']['actions']['reactivate']);
    }

    public function test_views_and_search(): void
    {
        $this->assertSame(['Carlo'], $this->names($this->actingAs($this->owner)->getJson(self::URL.'?filter[view]=pending')));
        $this->assertSame(['Felix', 'Ana'], $this->names($this->actingAs($this->owner)->getJson(self::URL.'?filter[view]=super_admins'))); // newest sign-in first
        $this->assertSame(['Mark'], $this->names($this->actingAs($this->owner)->getJson(self::URL.'?filter[view]=inactive')));

        $this->actingAs($this->owner)->getJson(self::URL.'?search=liz')
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('meta.views.all', 1)->assertJsonPath('meta.summary.total_accounts', 6);
        $this->actingAs($this->owner)->getJson(self::URL.'?search=john doe')->assertJsonCount(1, 'data');
        $this->actingAs($this->owner)->getJson(self::URL.'?search=%25')->assertJsonCount(0, 'data'); // "%" is a letter here
    }

    public function test_sort_menu(): void
    {
        $this->assertSame(['Ana', 'Carlo', 'Felix', 'John', 'Liza', 'Mark'], $this->names($this->actingAs($this->owner)->getJson(self::URL.'?sort=name&order=asc')));
        $this->assertSame(['Ana', 'Felix'], array_slice($this->names($this->actingAs($this->owner)->getJson(self::URL.'?sort=role')), 0, 2)); // Super Admins first, A–Z
        // Needs attention first: John (two-step off) and Carlo (pending) on top
        $this->assertEqualsCanonicalizing(['John', 'Carlo'], array_slice($this->names($this->actingAs($this->owner)->getJson(self::URL.'?sort=attention')), 0, 2));
    }

    public function test_pages_and_bad_input(): void
    {
        $this->actingAs($this->owner)->getJson(self::URL.'?per_page=4&page=2')
            ->assertOk()->assertJsonCount(2, 'data')->assertJsonPath('meta.current_page', 2)->assertJsonPath('meta.last_page', 2);

        $this->actingAs($this->owner)->getJson(self::URL.'?filter[view]=bogus')->assertStatus(422);
        $this->actingAs($this->owner)->getJson(self::URL.'?sort=salary')->assertStatus(422);
        $this->actingAs($this->owner)->getJson(self::URL.'?per_page=500')->assertStatus(422);
    }

    public function test_only_super_admins_get_in(): void
    {
        $this->getJson(self::URL)->assertUnauthorized();
        $this->actingAs(User::where('first_name', 'John')->first())->getJson(self::URL)->assertForbidden();
    }
}
