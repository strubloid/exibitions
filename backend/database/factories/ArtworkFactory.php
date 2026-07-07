<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Artwork> */
class ArtworkFactory extends Factory
{
    public function definition(): array
    {
        return [
            'title'           => $this->faker->words(3, true),
            'description'     => $this->faker->optional()->sentence,
            'image'           => null,
            'image_compressed'=> null,
            'sort_order'      => $this->faker->unique()->numberBetween(1, 1000),
            'animation_style' => $this->faker->randomElement(['fade', 'mask-reveal', 'parallax']),
            'metadata'        => null,
            'price_cents'     => $this->faker->optional()->numberBetween(5000, 1000000),
            'currency'        => 'USD',
            'is_available'    => true,
        ];
    }
}