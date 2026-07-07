<?php

namespace App\Services;

use App\Contracts\PaymentGateway;
use App\Models\Order;
use Illuminate\Support\Arr;
use RuntimeException;
use Stripe\Checkout\Session;
use Stripe\Exception\SignatureVerificationException;
use Stripe\Exception\UnexpectedValueException;
use Stripe\Stripe;
use Stripe\Webhook;

final class StripeGateway implements PaymentGateway
{
    public function __construct()
    {
        Stripe::setApiKey(config('services.stripe.secret'));
    }

    public function createCheckoutSession(Order $order, string $successUrl, string $cancelUrl): array
    {
        $lineItems = $order->items->map(fn ($item) => [
            'price_data' => [
                'currency'     => $order->currency,
                'product_data' => [
                    'name' => $item->title_snapshot,
                ],
                'unit_amount'  => $item->unit_price_cents,
            ],
            'quantity'   => 1,
        ])->all();

        $session = Session::create([
            'mode'               => 'payment',
            'line_items'         => $lineItems,
            'customer_email'     => $order->customer_email,
            'success_url'        => $successUrl,
            'cancel_url'         => $cancelUrl,
            'client_reference_id'=> $order->order_number,
            'metadata'           => [
                'order_number' => $order->order_number,
                'order_id'     => (string) $order->id,
            ],
        ]);

        return [
            'session_id' => $session->id,
            'url'        => $session->url,
        ];
    }

    public function retrieveSession(string $sessionId): array
    {
        $session = Session::retrieve($sessionId);

        return [
            'id'              => $session->id,
            'payment_intent'  => $session->payment_intent,
            'payment_status'  => $session->payment_status,
            'amount_total'    => $session->amount_total,
            'currency'        => $session->currency,
        ];
    }

    public function verifyWebhookSignature(string $payload, string $signatureHeader): \Stripe\Event
    {
        try {
            return Webhook::constructEvent(
                $payload,
                $signatureHeader,
                config('services.stripe.webhook_secret')
            );
        } catch (UnexpectedValueException|SignatureVerificationException $e) {
            throw new RuntimeException('Stripe webhook signature verification failed: ' . $e->getMessage(), 0, $e);
        }
    }
}