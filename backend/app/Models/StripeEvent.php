<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class StripeEvent extends Model
{
    /** PK is the Stripe event id (string), not auto-incrementing. */
    public $incrementing = false;
    protected $keyType   = 'string';

    /** We set received_at ourselves; disable Eloquent's timestamp management. */
    public $timestamps = false;

    protected $fillable = [
        'id',
        'type',
        'payload',
        'received_at',
    ];

    protected $casts = [
        'payload'     => 'array',
        'received_at' => 'datetime',
    ];
}