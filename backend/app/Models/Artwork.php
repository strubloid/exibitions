<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Artwork extends Model
{
    protected $fillable = [
        'title',
        'description',
        'image',
        'image_compressed',
        'sort_order',
        'animation_style',
        'metadata',
    ];

    protected $casts = [
        'metadata' => 'array',
    ];

    public function exhibitions(): BelongsToMany
    {
        return $this->belongsToMany(Exhibition::class)->withPivot('sort_order');
    }
}
