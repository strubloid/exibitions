<?php

namespace Tests\Feature;

use App\Enums\OrderStatus;
use App\Models\Artwork;
use App\Models\Order;
use App\Models\StripeEvent;
use App\Services\OrderService;
use App\Services\PricingService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CheckoutTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_can_create_order_with_valid_artwork(): void
    {
        $artwork = Artwork::factory()->create([
            'price_cents'  => 120000,
            'currency'     => 'USD',
            'is_available' => true,
        ]);

        $orders = app(OrderService::class);
        $order = $orders->createFromCheckout(
            [['artwork_id' => $artwork->id]],
            [
                'email'    => 'buyer@example.com',
                'name'     => 'Buyer Name',
                'shipping' => [
                    'line1'       => '123 Test St',
                    'city'        => 'Testville',
                    'postal_code' => '12345',
                    'country'     => 'US',
                ],
            ]
        );

        $this->assertInstanceOf(Order::class, $order);
        $this->assertSame(OrderStatus::Pending->value, $order->status);
        $this->assertSame(120000, $order->subtotal_cents);
        $this->assertSame(120000, $order->total_cents);
        $this->assertSame('buyer@example.com', $order->customer_email);
        $this->assertCount(1, $order->items);

        // Artwork is reserved.
        $this->assertFalse($artwork->fresh()->is_available);

        // Item snapshot contains the original title.
        $this->assertSame($artwork->title, $order->items->first()->title_snapshot);
        $this->assertSame(120000, $order->items->first()->unit_price_cents);
    }

    public function test_unavailable_artwork_throws_out_of_stock(): void
    {
        $artwork = Artwork::factory()->create([
            'price_cents'  => 120000,
            'currency'     => 'USD',
            'is_available' => false,
        ]);

        $this->expectException(\App\Exceptions\OutOfStockException::class);

        app(OrderService::class)->createFromCheckout(
            [['artwork_id' => $artwork->id]],
            ['email' => 'a@b.com', 'name' => 'X', 'shipping' => ['line1' => '1', 'city' => 'x', 'postal_code' => '1', 'country' => 'US']]
        );
    }

    public function test_checkout_with_no_items_fails_validation(): void
    {
        $res = $this->postJson('/api/checkout/session', [
            'items'     => [],
            'customer'  => ['email' => 'a@b.com', 'name' => 'X', 'shipping' => ['line1' => '1', 'city' => 'x', 'postal_code' => '1', 'country' => 'US']],
            'success_url' => 'http://localhost:5173/checkout/success?session_id={CHECKOUT_SESSION_ID}',
        ]);

        $res->assertStatus(422);
        $res->assertJsonValidationErrors(['items']);
    }

    public function test_checkout_with_invalid_country_fails_validation(): void
    {
        $artwork = Artwork::factory()->create(['price_cents' => 100, 'currency' => 'USD', 'is_available' => true]);

        $res = $this->postJson('/api/checkout/session', [
            'items'     => [['artwork_id' => $artwork->id]],
            'customer'  => ['email' => 'a@b.com', 'name' => 'X', 'shipping' => ['line1' => '1', 'city' => 'x', 'postal_code' => '1', 'country' => 'ZZ']],
            'success_url' => 'http://localhost:5173/checkout/success?session_id={CHECKOUT_SESSION_ID}',
        ]);

        $res->assertStatus(422);
        $res->assertJsonValidationErrors(['customer.shipping.country']);
    }

    public function test_checkout_with_open_redirect_url_fails_validation(): void
    {
        config(['app.frontend_url' => 'http://localhost:5173']);
        $artwork = Artwork::factory()->create(['price_cents' => 100, 'currency' => 'USD', 'is_available' => true]);

        $res = $this->postJson('/api/checkout/session', [
            'items'     => [['artwork_id' => $artwork->id]],
            'customer'  => ['email' => 'a@b.com', 'name' => 'X', 'shipping' => ['line1' => '1', 'city' => 'x', 'postal_code' => '1', 'country' => 'US']],
            'success_url' => 'https://evil.com/checkout/success',
        ]);

        $res->assertStatus(422);
        $res->assertJsonValidationErrors(['success_url']);
    }

    public function test_sold_artwork_does_not_appear_in_browseable_list(): void
    {
        $available = Artwork::factory()->create(['is_available' => true]);
        $sold      = Artwork::factory()->create(['is_available' => false]);

        $res = $this->getJson('/api/artworks');

        $res->assertStatus(200);
        $ids = collect($res->json())->pluck('id');
        $this->assertContains($available->id, $ids);
        $this->assertNotContains($sold->id, $ids);
    }

    public function test_mark_paid_is_idempotent(): void
    {
        $order = Order::factory()->create([
            'status'            => OrderStatus::Pending->value,
            'stripe_session_id' => 'cs_test_123',
        ]);

        $svc = app(OrderService::class);
        $first  = $svc->markPaid('cs_test_123', 'pi_test_abc');
        $second = $svc->markPaid('cs_test_123', 'pi_test_abc');

        $this->assertSame(OrderStatus::Paid->value, $first->status);
        $this->assertSame(OrderStatus::Paid->value, $second->status);
        $this->assertSame($first->id, $second->id);
        $this->assertNotNull($second->paid_at);
    }

    public function test_mark_cancelled_restores_artwork_availability(): void
    {
        $artwork = Artwork::factory()->create(['is_available' => false, 'price_cents' => 100, 'currency' => 'USD']);
        $order = Order::factory()->create([
            'status'            => OrderStatus::Pending->value,
            'stripe_session_id' => 'cs_test_456',
        ]);
        $order->items()->create([
            'artwork_id'       => $artwork->id,
            'title_snapshot'   => $artwork->title,
            'image_snapshot'   => null,
            'unit_price_cents' => 100,
            'currency'         => 'USD',
        ]);

        app(OrderService::class)->markCancelledAndRestoreArtworks('cs_test_456');

        $this->assertSame(OrderStatus::Cancelled->value, $order->fresh()->status);
        $this->assertTrue($artwork->fresh()->is_available);
    }

    public function test_webhook_with_invalid_signature_returns_400(): void
    {
        $res = $this->postJson('/api/webhooks/stripe', ['id' => 'evt_test_bad'], [
            'Stripe-Signature' => 't=1,v1=fakesig',
        ]);

        // Signature verification fails before any DB write.
        $res->assertStatus(400);
        $this->assertDatabaseMissing('stripe_events', ['id' => 'evt_test_bad']);
    }

    public function test_webhook_without_signature_header_returns_400(): void
    {
        $res = $this->postJson('/api/webhooks/stripe', ['id' => 'evt_test_nosig']);
        $res->assertStatus(400);
    }
}