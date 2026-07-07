<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Artwork extends Model
{
    use HasFactory;

    protected $fillable = [
        'title',
        'description',
        'image',
        'image_compressed',
        'sort_order',
        'animation_style',
        'metadata',
        'price_cents',
        'currency',
        'is_available',
    ];

    protected $casts = [
        'metadata'     => 'array',
        'is_available' => 'boolean',
    ];

    public function exhibitions(): BelongsToMany
    {
        return $this->belongsToMany(Exhibition::class)->withPivot('sort_order');
    }

    public function orderItems(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }

    /** Scope: only artworks currently browseable by the public. */
    public function scopeBrowseable(Builder $q): Builder
    {
        return $q->where('is_available', true);
    }

    /** Scope: artworks explicitly for sale with a price. */
    public function scopeForSale(Builder $q): Builder
    {
        return $q->whereNotNull('price_cents')->where('is_available', true);
    }
}