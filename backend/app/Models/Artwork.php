<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Artwork extends Model
{
    protected $fillable = [
        'title',
        'description',
        'image',
        'sort_order',
        'animation_style',
        'metadata',
    ];

    protected $casts = [
        'metadata' => 'array',
    ];
}
