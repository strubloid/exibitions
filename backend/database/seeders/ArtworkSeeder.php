<?php

namespace Database\Seeders;

use App\Models\Artwork;
use Illuminate\Database\Seeder;

class ArtworkSeeder extends Seeder
{
    public function run(): void
    {
        $artworks = [
            [
                'title' => 'Solitude in Blue',
                'description' => 'A vast ocean of blue stretching into infinite silence.',
                'image' => null,
                'sort_order' => 1,
                'animation_style' => 'mask-reveal',
                'metadata' => ['palette' => ['#0a1628', '#1e3a5f', '#4a90d9']],
            ],
            [
                'title' => 'Ember Fields',
                'description' => 'Warm amber light bleeds across an open landscape at dusk.',
                'image' => null,
                'sort_order' => 2,
                'animation_style' => 'parallax',
                'metadata' => ['palette' => ['#1a0a00', '#8b3a00', '#f4a020']],
            ],
            [
                'title' => 'Void Architecture',
                'description' => 'Brutalist geometry dissolved into pure shadow and form.',
                'image' => null,
                'sort_order' => 3,
                'animation_style' => 'fade',
                'metadata' => ['palette' => ['#0d0d0d', '#2a2a2a', '#f0f0f0']],
            ],
        ];

        foreach ($artworks as $artwork) {
            Artwork::firstOrCreate(
                ['title' => $artwork['title']],
                $artwork
            );
        }
    }
}
