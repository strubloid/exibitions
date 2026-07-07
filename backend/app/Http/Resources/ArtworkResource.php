<?php

namespace App\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

class ArtworkResource extends JsonResource
{
    private bool $withDetail = false;

    public function withDetail(): static
    {
        $this->withDetail = true;
        return $this;
    }

    public function toArray($request): array
    {
        $data = [
            'id'             => $this->id,
            'title'          => $this->title,
            'image'          => $this->image,
            'image_compressed' => $this->image_compressed,
            'price_cents'    => $this->price_cents,
            'currency'       => $this->currency,
            'is_available'   => $this->is_available,
        ];

        if ($this->withDetail) {
            $data['description']      = $this->description;
            $data['sort_order']       = $this->sort_order;
            $data['animation_style']  = $this->animation_style;
            $data['metadata']         = $this->metadata;
            $data['created_at']       = $this->created_at?->toIso8601String();
            $data['updated_at']       = $this->updated_at?->toIso8601String();
        }

        return $data;
    }
}