<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OrderItem extends Model
{
    protected $fillable = [
        'order_id',
        'artwork_id',
        'title_snapshot',
        'image_snapshot',
        'unit_price_cents',
        'currency',
    ];

    protected $casts = [
        'unit_price_cents' => 'integer',
    ];

    public function artwork(): BelongsTo
    {
        return $this->belongsTo(Artwork::class);
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }
}