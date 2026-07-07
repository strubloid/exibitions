<?php

namespace App\Http\Controllers;

use App\Contracts\PaymentGateway;
use App\Models\StripeEvent;
use App\Services\OrderService;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use RuntimeException;

class WebhookController extends Controller
{
    public function __construct(
        private readonly PaymentGateway $gateway,
        private readonly OrderService $orders,
    ) {
    }

    public function stripe(Request $request): Response
    {
        // Read the raw body — $request->all() would parse and break signature verification.
        $payload   = $request->getContent();
        $signature = $request->header('Stripe-Signature');

        if (!$signature) {
            Log::warning('Stripe webhook received without signature header', ['ip' => $request->ip()]);
            return response('Missing signature', 400);
        }

        try {
            $event = $this->gateway->verifyWebhookSignature($payload, $signature);
        } catch (RuntimeException $e) {
            Log::warning('Stripe webhook signature verification failed', ['ip' => $request->ip(), 'error' => $e->getMessage()]);
            return response('Invalid signature', 400);
        }

        // Idempotency: if we've seen this event already, return 200 and do nothing.
        // Insert the row inside the transaction so a mid-handler failure rolls it
        // back and Stripe retries — correct behaviour.
        return DB::transaction(function () use ($event, $payload): Response {
            if (StripeEvent::where('id', $event->id)->exists()) {
                return response('ok', 200);
            }

            StripeEvent::create([
                'id'          => $event->id,
                'type'        => $event->type,
                'payload'     => json_decode($payload, true),
                'received_at' => now(),
            ]);

            Log::info('Stripe webhook received', ['event_id' => $event->id, 'type' => $event->type]);

            $session   = $event->data?->object;
            $sessionId = $session->id ?? null;

            switch ($event->type) {
                case 'checkout.session.completed':
                    if ($sessionId) {
                        $this->orders->markPaid($sessionId, $session->payment_intent ?? null);
                    }
                    break;

                case 'checkout.session.expired':
                case 'payment_intent.payment_failed':
                    if ($sessionId) {
                        $this->orders->markCancelledAndRestoreArtworks($sessionId);
                    }
                    break;

                case 'charge.refunded':
                    $intentId                  = $session->payment_intent ?? $session->id ?? null;
                    if ($intentId) {
                        $this->orders->markRefunded($intentId);
                    }
                    break;

                default:
                    Log::info('Stripe webhook unhandled type', ['type' => $event->type]);
                    break;
            }

            return response('ok', 200);
        });
    }
}