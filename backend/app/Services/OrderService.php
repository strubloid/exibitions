<?php

namespace App\Services;

use App\Enums\OrderStatus;
use App\Exceptions\OutOfStockException;
use App\Models\Artwork;
use App\Models\Order;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use RuntimeException;

final class OrderService
{
    public function __construct(private readonly PricingService $pricing)
    {
    }

    /**
     * Create an Order from a validated checkout payload. The server is the
     * source of truth for prices and availability — the client-sent items list
     * contains only artwork_id values, and we re-fetch the artwork rows
     * inside a transaction to enforce that.
     *
     * @param array<int, array{artwork_id:int}> $items
     * @param array{email:string, name:string, shipping:array} $customer
     * @throws OutOfStockException when any artwork is unavailable or unpriced
     * @throws RuntimeException on order_number generation failure
     */
    public function createFromCheckout(array $items, array $customer): Order
    {
        $artworkIds = array_map(fn ($i) => $i['artwork_id'], $items);

        return DB::transaction(function () use ($artworkIds, $customer, $items) {
            // Lock artworks for update: serialises concurrent buyers of the same piece.
            $artworks = Artwork::whereIn('id', $artworkIds)
                ->orderBy('sort_order')
                ->lockForUpdate()
                ->get()
                ->keyBy('id');

            // Validate each requested id is present, available and for sale.
            foreach ($artworkIds as $id) {
                $artwork = $artworks->get($id);
                if (!$artwork || !$artwork->is_available || $artwork->price_cents === null) {
                    throw new OutOfStockException('Artwork id ' . $id . ' is unavailable or not for sale.');
                }
            }

            $subtotal = $artworks->sum(fn (Artwork $a) => (int) $a->price_cents);
            $currency = $artworks->first()->currency ?? 'USD';
            $shipping = 0;
            $tax = 0;
            $total = $subtotal + $shipping + $tax;

            /** @var Order $order */
            $order = Order::create([
                'order_number'     => Order::generateOrderNumber(),
                'status'           => OrderStatus::Pending->value,
                'currency'         => $currency,
                'subtotal_cents'   => $subtotal,
                'shipping_cents'   => $shipping,
                'tax_cents'        => $tax,
                'total_cents'      => $total,
                'customer_email'   => $customer['email'],
                'customer_name'    => $customer['name'],
                'shipping_address' => $customer['shipping'],
            ]);

            foreach ($artworks as $artwork) {
                $order->items()->create([
                    'artwork_id'       => $artwork->id,
                    'title_snapshot'   => $artwork->title,
                    'image_snapshot'   => $artwork->image,
                    'unit_price_cents' => (int) $artwork->price_cents,
                    'currency'         => $currency,
                ]);
            }

            // Reserve the pieces atomically with the order.
            Artwork::whereIn('id', $artworkIds)->update(['is_available' => false]);

            return $order->fresh(['items']);
        });
    }

    /**
     * Mark an order Paid from a verified Stripe webhook. Idempotent:
     * repeated checkout.session.completed events for the same session are no-ops.
     */
    public function markPaid(string $stripeSessionId, ?string $paymentIntentId): Order
    {
        $order = $this->findBySessionId($stripeSessionId);
        if (!$order) {
            throw new RuntimeException('Order not found for session ' . $stripeSessionId);
        }

        if ($order->status === OrderStatus::Paid->value) {
            return $order; // idempotent
        }

        DB::transaction(function () use ($order, $paymentIntentId) {
            $order->status = OrderStatus::Paid->value;
            $order->paid_at = now();
            if ($paymentIntentId) {
                $order->stripe_payment_intent_id = $paymentIntentId;
            }
            $order->save();
        });

        Log::info('Order marked paid', ['order_number' => $order->order_number]);
        return $order->fresh();
    }

    /**
     * Mark an order Cancelled and re-list its artworks so the next buyer can purchase them.
     * Idempotent for repeated expired/failed webhooks.
     */
    public function markCancelledAndRestoreArtworks(string $stripeSessionId): ?Order
    {
        $order = $this->findBySessionId($stripeSessionId);
        if (!$order) {
            return null;
        }

        if ($order->status !== OrderStatus::Pending->value) {
            return $order;
        }

        DB::transaction(function () use ($order) {
            Artwork::whereIn('id', $order->items()->pluck('artwork_id'))->update(['is_available' => true]);
            $order->status = OrderStatus::Cancelled->value;
            $order->save();
        });

        Log::info('Order cancelled and artworks restored', ['order_number' => $order->order_number]);
        return $order->fresh();
    }

    public function markRefunded(string $stripePaymentIntentId): ?Order
    {
        $order = Order::where('stripe_payment_intent_id', $stripePaymentIntentId)->first();
        if (!$order || $order->status === OrderStatus::Refunded->value) {
            return $order;
        }

        $order->status = OrderStatus::Refunded->value;
        $order->save();

        Log::info('Order marked refunded', ['order_number' => $order->order_number]);
        return $order->fresh();
    }

    public function findBySessionId(string $sessionId): ?Order
    {
        return Order::where('stripe_session_id', $sessionId)->first();
    }
}