<?php

namespace Database\Factories;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * A FACTORY is a "recipe" for making fake users.
 * Each call to User::factory()->create() follows this recipe and saves one
 * new user with random (fake) values. In tests that user goes into the
 * testing database.
 *
 * The columns here must match the real `users` table.
 *
 * @extends Factory<User>
 */
class UserFactory extends Factory
{
    /**
     * Every fake user gets the password "password" (hashed once and reused, so tests stay fast).
     */
    protected static ?string $password;

    /**
     * The default recipe: an active, accepted accounting clerk.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'employee_id' => 'EMP-'.fake()->unique()->numerify('#####'),
            'first_name' => fake()->firstName(),
            'last_name' => fake()->lastName(),
            'email' => fake()->unique()->safeEmail(),
            'password' => static::$password ??= Hash::make('password'),
            'is_active' => true,
            'access_status' => 'accepted',
            'role' => 'accounting_clerk',
            'department_id' => null,
            'company_id' => null,
            'remember_token' => Str::random(10),
        ];
    }

    /*
     * "STATES" are small changes to the recipe:
     *   User::factory()->admin()->create();
     *   User::factory()->officer()->inactive()->create();
     */

    public function admin(): static
    {
        return $this->state(fn () => ['role' => 'admin']);
    }

    public function officer(): static
    {
        return $this->state(fn () => ['role' => 'accounting_officer']);
    }

    public function supervisor(): static
    {
        return $this->state(fn () => ['role' => 'supervisor_manager']);
    }

    public function inactive(): static
    {
        return $this->state(fn () => ['is_active' => false]);
    }

    public function pending(): static
    {
        return $this->state(fn () => ['access_status' => 'pending']);
    }
}
