<?php

namespace App\Http\Controllers;

use App\Contracts\PaymentGateway;
use App\Enums\OrderStatus;
use App\Exceptions\OutOfStockException;
use App\Http\Requests\StoreCheckoutRequest;
use App\Models\Artwork;
use App\Models\Order;
use App\Services\OrderService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use RuntimeException;

class CheckoutController extends Controller
{
    public function __construct(
        private readonly OrderService $orders,
        private readonly PaymentGateway $gateway,
    ) {
    }

    /**
     * Create a Stripe Checkout session for the buyer.
     * Artworks are reserved atomically inside the order creation transaction;
     * if the Stripe call fails afterwards, we cancel the order and restore availability.
     */
    public function createSession(StoreCheckoutRequest $request): JsonResponse
    {
        $data = $request->validated();

        try {
            $order = $this->orders->createFromCheckout($data['items'], $data['customer']);
        } catch (OutOfStockException $e) {
            return response()->json(['message' => 'One or more artworks are no longer available.', 'error' => $e->getMessage()], 409);
        }

        $successUrl = $data['success_url'];
        $cancelUrl  = rtrim(config('app.frontend_url'), '/') . '/checkout/cancel';

        try {
            $session = $this->gateway->createCheckoutSession(
                $order,
                $successUrl,
                $cancelUrl
            );

            $order->stripe_session_id = $session['session_id'];
            $order->save();

            return response()->json([
                'session_id' => $session['session_id'],
                'url'        => $session['url'],
            ], 201);
        } catch (RuntimeException $e) {
            // Stripe failed — cancel the order and return artworks to circulation.
            Log::error('Stripe createCheckoutSession failed', ['order' => $order->id, 'error' => $e->getMessage()]);

            // No Stripe session_id yet — restore by order id directly inside a transaction.
            DB::transaction(function () use ($order) {
                Artwork::whereIn('id', $order->items()->pluck('artwork_id'))->update(['is_available' => true]);
                $order->status = OrderStatus::Cancelled->value;
                $order->save();
            });

            return response()->json(['message' => 'Payment provider error. Please try again.', 'error' => $e->getMessage()], 502);
        }
    }

    /**
     * Public success endpoint polled by the frontend after Stripe returns the buyer.
     * Does NOT mark the order paid — only the webhook does that. We only report status.
     */
    public function success(Request $request): JsonResponse
    {
        $sessionId = $request->query('session_id');
        if (!$sessionId) {
            return response()->json(['message' => 'Missing session_id'], 400);
        }

        $order = $this->orders->findBySessionId($sessionId);
        if (!$order) {
            return response()->json(['message' => 'Order not found'], 404);
        }

        return response()->json([
            'order_number' => $order->order_number,
            'status'       => $order->status,
            'paid_at'      => $order->paid_at?->toIso8601String(),
        ]);
    }

    /**
     * Admin/poll helper: fetch the Stripe session's payment_status.
     */
    public function status(Request $request, string $sessionId): JsonResponse
    {
        $order = $this->orders->findBySessionId($sessionId);
        if (!$order) {
            return response()->json(['message' => 'Order not found'], 404);
        }

        try {
            $session = $this->gateway->retrieveSession($sessionId);
            return response()->json([
                'order_status'    => $order->status,
                'stripe_status'   => $session['payment_status'],
                'paid_at'         => $order->paid_at?->toIso8601String(),
            ]);
        } catch (RuntimeException $e) {
            return response()->json(['message' => 'Unable to fetch session from Stripe', 'error' => $e->getMessage()], 502);
        }
    }
}