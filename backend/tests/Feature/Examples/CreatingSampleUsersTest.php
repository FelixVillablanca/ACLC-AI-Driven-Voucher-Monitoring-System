<?php

namespace Tests\Feature\Examples;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * LEARNING FILE: how to put sample users into the TESTING database.
 *
 * Run only this file:   php artisan test --filter=CreatingSampleUsersTest
 *
 * How it works:
 * 1. `use RefreshDatabase;` gives every test a CLEAN testing database.
 *    Whatever a test creates is thrown away when that test ends, so
 *    tests never affect each other.
 * 2. Inside a test you create data with the FACTORY
 *    (database/factories/UserFactory.php).
 * 3. Then you CHECK something with an "assert" (assert = "I expect that...").
 *    If the expectation is wrong, the test fails and tells you why.
 *
 * Every test method name must start with "test_".
 */
class CreatingSampleUsersTest extends TestCase
{
    use RefreshDatabase;

    public function test_create_one_random_user(): void
    {
        // Make 1 fake user (random name, random email) and save it
        $user = User::factory()->create();

        // Check: is that user really in the `users` table?
        $this->assertDatabaseHas('users', ['email' => $user->email]);
        $this->assertDatabaseCount('users', 1);
    }

    public function test_create_a_user_with_my_own_values(): void
    {
        // Whatever you pass in replaces the random values from the recipe
        $user = User::factory()->create([
            'first_name' => 'Juan',
            'last_name' => 'Dela Cruz',
            'email' => 'juan@example.com',
        ]);

        $this->assertSame('Juan', $user->first_name);
        $this->assertDatabaseHas('users', [
            'email' => 'juan@example.com',
            'role' => 'accounting_clerk', // default from the recipe
        ]);
    }

    public function test_create_users_with_different_roles(): void
    {
        // "States" (admin, officer, supervisor...) are defined in UserFactory
        User::factory()->admin()->create();
        User::factory()->officer()->create();
        User::factory()->supervisor()->create();
        User::factory()->count(5)->create(); // 5 clerks at once

        $this->assertDatabaseCount('users', 8);
        $this->assertSame(5, User::where('role', 'accounting_clerk')->count());
    }

    public function test_the_password_is_stored_scrambled_not_as_plain_text(): void
    {
        $user = User::factory()->create(); // password is "password"

        // In the DB the password is "hashed" (scrambled), never readable
        $this->assertNotSame('password', $user->getAttributes()['password']);
        $this->assertTrue(password_verify('password', $user->password));
    }

    public function test_every_test_starts_with_an_empty_database(): void
    {
        // The users made in the tests above are gone: each test starts clean
        $this->assertDatabaseCount('users', 0);
    }
}
