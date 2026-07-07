<?php

namespace Database\Factories;

use App\Enums\OrderStatus;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Order> */
class OrderFactory extends Factory
{
    public function definition(): array
    {
        return [
            'order_number'      => 'EX-' . now()->format('Ymd') . '-' . str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT),
            'status'            => OrderStatus::Pending->value,
            'currency'          => 'USD',
            'subtotal_cents'    => $this->faker->numberBetween(1000, 100000),
            'shipping_cents'    => 0,
            'tax_cents'         => 0,
            'total_cents'       => fn (array $a) => $a['subtotal_cents'],
            'customer_email'    => $this->faker->safeEmail,
            'customer_name'     => $this->faker->name,
            'shipping_address'  => [
                'line1'       => $this->faker->streetAddress,
                'city'        => $this->faker->city,
                'postal_code' => $this->faker->postcode,
                'country'     => 'US',
            ],
            'stripe_session_id' => null,
            'stripe_payment_intent_id' => null,
            'paid_at'           => null,
        ];
    }
}