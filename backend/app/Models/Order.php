<?php

namespace App\Models;

use App\Enums\OrderStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\QueryException;
use RuntimeException;

class Order extends Model
{
    use HasFactory;

    protected $fillable = [
        'order_number',
        'status',
        'currency',
        'subtotal_cents',
        'shipping_cents',
        'tax_cents',
        'total_cents',
        'customer_email',
        'customer_name',
        'shipping_address',
        'stripe_session_id',
        'stripe_payment_intent_id',
        'paid_at',
    ];

    protected $casts = [
        'shipping_address'  => 'array',
        'paid_at'           => 'datetime',
        'subtotal_cents'    => 'integer',
        'shipping_cents'    => 'integer',
        'tax_cents'         => 'integer',
        'total_cents'       => 'integer',
    ];

    public function items(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }

    public function payment(): HasOne
    {
        return $this->hasOne(Payment::class);
    }

    /**
     * Human-readable order number: EX-YYYYMMDD-NNNNNN.
     * Retried on a unique-constraint collision (collision chance is 1-in-10^6).
     */
    public static function generateOrderNumber(): string
    {
        for ($attempts = 0; $attempts < 5; $attempts++) {
            $candidate = 'EX-' . now()->format('Ymd') . '-' . str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);

            if (! self::where('order_number', $candidate)->exists()) {
                return $candidate;
            }
        }

        throw new RuntimeException('Failed to generate a unique order_number after 5 attempts.');
    }

    public function isPaid(): bool
    {
        return $this->status === OrderStatus::Paid->value;
    }
}