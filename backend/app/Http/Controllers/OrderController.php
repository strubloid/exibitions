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

        // Shape matches the AdminOrders frontend contract:
        // { data: OrderResource[], current_page, last_page, total, per_page }
        // Wrapped in OrderResource so we control field exposure (e.g. PI fields).
        return response()->json([
            'data'         => OrderResource::collection($orders->items()),
            'current_page' => $orders->currentPage(),
            'last_page'    => $orders->lastPage(),
            'per_page'     => $orders->perPage(),
            'total'        => $orders->total(),
        ]);
    }

    public function show(Order $order): JsonResponse
    {
        $order->load(['items.artwork']);

        return response()->json(new OrderResource($order));
    }
}