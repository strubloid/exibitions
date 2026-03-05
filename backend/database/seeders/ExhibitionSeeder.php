<?php

namespace Database\Seeders;

use App\Models\Exhibition;
use Illuminate\Database\Seeder;

class ExhibitionSeeder extends Seeder
{
    public function run(): void
    {
        // Only seed if table is empty (development) or in non-production environment
        if (Exhibition::exists()) {
            return;
        }

        $exhibitions = [
            [
                'name' => 'Morte e vida Severino',
                'description' => 'This body of work explores the fragile boundary between survival and erasure, echoing the existential tension present in Morte e Vida Severina. Through painterly photographic compositions and accompanying poems, Rafael Mendes investigates the human condition under pressure, where hope becomes necessity rather than luxury.

The figures depicted do not pose; they emerge. Bodies ignite in chromatic intensity against darkness, suggesting struggle, longing, recognition, and the quiet violence of invisibility. Light is not decorative but defiant. It functions as resistance, as breath, as proof of presence.

The poems expand these visual narratives, addressing inequality, emotional hunger, delayed recognition, and the resilience required to remain alive in systems that often overlook certain lives. Hope here is not romanticized. It is survival. It is endurance. It is the force that moves the day when nothing else does.

Together, image and language form a contemporary Severino, not bound to geography, but to the universal experience of striving to exist with dignity.',
                'slug' => 'morteevideseverino',
                'sort_order' => 1,
                'cover_image' => '/storage/exhibitions/exhibition-1.webp',
            ]
        ];

        foreach ($exhibitions as $exhibition) {
            Exhibition::firstOrCreate(
                ['slug' => $exhibition['slug']],
                $exhibition
            );
        }
    }
}
