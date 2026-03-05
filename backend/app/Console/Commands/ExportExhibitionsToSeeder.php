<?php

namespace App\Console\Commands;

use App\Models\Exhibition;
use Illuminate\Console\Command;

class ExportExhibitionsToSeeder extends Command
{
    protected $signature = 'artworks:export-exibitions';
    protected $description = 'Export current exhibitions to seeder format';

    public function handle()
    {
        $exhibitions = Exhibition::orderBy('sort_order')->get();

        if ($exhibitions->isEmpty()) {
            $this->error('No exhibitions found in database.');
            return;
        }

        $this->info('Copy the code below to update ExhibitionSeeder.php:');
        $this->info('');

        $code = "        \$exhibitions = [\n";

        foreach ($exhibitions as $exhibition) {
            $code .= "            [\n";
            $code .= "                'name' => '" . addslashes($exhibition->name) . "',\n";
            $code .= "                'description' => '" . addslashes($exhibition->description ?? '') . "',\n";
            $code .= "                'slug' => '" . addslashes($exhibition->slug) . "',\n";
            $code .= "                'sort_order' => {$exhibition->sort_order},\n";

            if ($exhibition->cover_image) {
                $code .= "                'cover_image' => '" . addslashes($exhibition->cover_image) . "',\n";
            }

            $code .= "            ],\n";
        }

        $code .= "        ];\n";

        $this->line($code);
        $this->info('');
        $this->info('✓ Total exhibitions: ' . $exhibitions->count());
    }
}
