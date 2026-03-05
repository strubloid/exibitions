<?php

namespace App\Console\Commands;

use App\Models\Artwork;
use Illuminate\Console\Command;

class ExportArtworksToSeeder extends Command
{
    protected $signature = 'artworks:export-seeder';
    protected $description = 'Export current artworks to seeder format';

    public function handle()
    {
        $artworks = Artwork::orderBy('sort_order')->get();

        if ($artworks->isEmpty()) {
            $this->error('No artworks found in database.');
            return;
        }

        $this->info('Copy the code below to update ArtworkSeeder.php:');
        $this->info('');

        $code = "        \$artworks = [\n";

        foreach ($artworks as $artwork) {
            $code .= "            [\n";
            $code .= "                'title' => '" . addslashes($artwork->title) . "',\n";
            $code .= "                'description' => '" . addslashes($artwork->description ?? '') . "',\n";
            $code .= "                'image' => " . ($artwork->image ? "'" . $artwork->image . "'" : 'null') . ",\n";
            $code .= "                'sort_order' => {$artwork->sort_order},\n";
            $code .= "                'animation_style' => '" . ($artwork->animation_style ?? 'mask-reveal') . "',\n";

            if ($artwork->metadata) {
                $metadata = var_export($artwork->metadata, true);
                $code .= "                'metadata' => {$metadata},\n";
            } else {
                $code .= "                'metadata' => [],\n";
            }

            $code .= "            ],\n";
        }

        $code .= "        ];\n";

        $this->line($code);
        $this->info('');
        $this->info('✓ Total artworks: ' . $artworks->count());
    }
}
