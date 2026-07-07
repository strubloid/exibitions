<?php

namespace App\Http\Resources;

use App\Enums\OrderStatus;
use Illuminate\Http\Resources\Json\JsonResource;

class OrderResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id'            => $this->id,
            'order_number'  => $this->order_number,
            'status'        => $this->status,
            'status_label'  => OrderStatus::tryFrom($this->status)?->label() ?? $this->status,
            'currency'      => $this->currency,
            'subtotal_cents'   => $this->subtotal_cents,
            'shipping_cents'   => $this->shipping_cents,
            'tax_cents'         => $this->tax_cents,
            'total_cents'       => $this->total_cents,
            'customer_email'   => $this->customer_email,
            'customer_name'     => $this->customer_name,
            'shipping_address'  => $this->shipping_address,
            'paid_at'           => $this->paid_at?->toIso8601String(),
            'items'             => OrderItemResource::collection($this->whenLoaded('items')),
            'stripe_session_id'         => $this->when($this->resource->relationLoaded('items') || true, $this->stripe_session_id),
            'stripe_payment_intent_id'  => $this->stripe_payment_intent_id,
            'created_at'      => $this->created_at?->toIso8601String(),
            'updated_at'      => $this->updated_at?->toIso8601String(),
        ];
    }
}