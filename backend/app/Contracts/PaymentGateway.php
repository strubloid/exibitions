<?php

namespace App\Contracts;

use App\Models\Order;
use Stripe\Event;

interface PaymentGateway
{
    /**
     * Create a Stripe Checkout Session for the given order.
     *
     * @return array{session_id:string, url:string}
     */
    public function createCheckoutSession(Order $order, string $successUrl, string $cancelUrl): array;

    /**
     * Retrieve a Stripe Checkout Session by id and return a normalised view.
     *
     * @return array{id:string, payment_intent:?string, payment_status:string, amount_total:int, currency:string}
     */
    public function retrieveSession(string $sessionId): array;

    /**
     * Verify the raw webhook payload against the Stripe-Signature header.
     * Throws on invalid signature; caller catches and returns 400.
     */
    public function verifyWebhookSignature(string $payload, string $signatureHeader): Event;
}