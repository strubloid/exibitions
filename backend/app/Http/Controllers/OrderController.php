<?php

namespace App\Http\Controllers;

use App\Http\Resources\OrderResource;
use App\Models\Order;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class OrderController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Order::query()->orderByDesc('created_at');

        if ($status = $request->query('status')) {
            $query->where('status', $status);
        }

        $orders = $query->with('items')->paginate(25);

        return response()->json($orders);
    }

    public function show(Order $order): JsonResponse
    {
        $order->load(['items.artwork']);

        return response()->json(new OrderResource($order));
    }
}