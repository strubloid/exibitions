<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Exhibition extends Model
{
    protected $fillable = ['name', 'description', 'background', 'clippings', 'slug', 'cover_image', 'sort_order'];

    protected $casts = [
        'clippings' => 'array',
    ];

    public function artworks(): BelongsToMany
    {
        return $this->belongsToMany(Artwork::class)
            ->withPivot('sort_order')
            ->orderByPivot('sort_order');
    }
}
