<?php

namespace App\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

class OrderItemResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id'             => $this->id,
            'artwork_id'     => $this->artwork_id,
            'title_snapshot' => $this->title_snapshot,
            'image_snapshot' => $this->image_snapshot,
            'unit_price_cents' => $this->unit_price_cents,
            'currency'       => $this->currency,
        ];
    }
}