<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Payment extends Model
{
    protected $fillable = [
        'order_id',
        'provider',
        'provider_session_id',
        'provider_payment_intent_id',
        'amount_cents',
        'currency',
        'status',
        'raw_response',
    ];

    protected $casts = [
        'raw_response'  => 'array',
        'amount_cents'  => 'integer',
    ];

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }
}