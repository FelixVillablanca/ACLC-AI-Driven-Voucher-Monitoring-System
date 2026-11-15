<?php

namespace Database\Factories;

use App\Models\Company;
use App\Models\Department;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * Recipe for fake departments. If you don't say which company,
 * it makes a new company for it automatically.
 *
 * @extends Factory<Department>
 */
class DepartmentFactory extends Factory
{
    public function definition(): array
    {
        return [
            'company_id' => Company::factory(),
            'name' => fake()->randomElement(['Accounting', 'Human Resources', 'Operations', 'Marketing']),
            'code' => strtoupper(fake()->unique()->lexify('???')),
            'description' => null,
            'head_user_id' => null,
            'is_active' => true,
        ];
    }
}
