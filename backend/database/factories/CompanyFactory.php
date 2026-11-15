<?php

namespace Database\Factories;

use App\Models\Company;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * Recipe for fake companies.
 *
 * @extends Factory<Company>
 */
class CompanyFactory extends Factory
{
    public function definition(): array
    {
        return [
            'name' => fake()->unique()->company(),
            'type' => 'corporate',
            'address' => fake()->address(),
            'contact_email' => fake()->companyEmail(),
            'contact_phone' => fake()->numerify('09#########'),
            'fiscal_year_start' => now()->startOfYear(),
            'tin_number' => fake()->numerify('###-###-###-000'),
            'is_active' => true,
        ];
    }
}
