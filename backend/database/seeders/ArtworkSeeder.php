<?php

namespace Database\Seeders;

use App\Models\Artwork;
use Illuminate\Database\Seeder;

class ArtworkSeeder extends Seeder
{
    public function run(): void
    {
        // Only seed if table is empty (development) or in non-production environment
        // This prevents overwriting real data on production deployments
        if (Artwork::exists()) {
            return;
        }

        $artworks = [
            [
                'title' => 'Agony',
                'description' => 'On this day, it strikes you hard,
                                A silent blade without a guard,
                                Do not revolt nor curse the scar,
                                Pain reveals you as you are.

                                It is the force that makes you real,
                                The hidden nerve you learn to feel,
                                Do not imagine you can flee,
                                For it will linger faithfully.

                                Accept that you must let it stay,
                                And walk with it along your way,
                                It lives within your private core,
                                Yet makes you stronger than before.

                                It shapes your mind, refines your sight,
                                It sharpens thought through darkest night,
                                So you may face what once seemed vast,
                                And turn your trials into the past.


                                With steady wisdom, calm and clear,
                                You rise above the weight of fear,
                                Your moral flame begins to climb,
                                Outgrowing doubt, outlasting time.

                                To reach an ending bright and wise,
                                Where earned fulfilment softly lies,
                                You cross a road of fierce temptation,
                                Within this coded, chance-bound creation.

                                Learn from the ache that bends your frame,
                                For growth and struggle are the same,
                                Evolve, ascend, refine your art,
                                Let the deeper vision guide your heart.

                                Master the storm of every sense,
                                Choose which emotions gain defence,
                                For life is restless, wild, and broad,
                                Yet this true path is yours to trod.',
                'image' => '/storage/artworks/1.webp',
                'sort_order' => 1,
                'animation_style' => 'parallax',
                'metadata' => array (
                    'palette' => array (
                            0 => '#1d1210',
                            1 => '#43261f',
                            2 => '#1c100d',
                        ),
                    ),
            ],
            [
                'title' => 'Arousal',
                'description' => 'Oh great dilemma, cruel yet desired,
                                You in my life are fiercely required,
                                At any hour you rise and inspire,
                                From innocence trembling to infamous fire.

                                You will corrupt my being through thought,
                                Seducing each moment my longing has caught,
                                You will grow intimate, precious, refined,
                                And conquer my will though I struggle in mind.

                                You leave this being crooked in scheme,
                                Stained by the shade of a fevered dream,
                                A soul that has always hungered for more,
                                And for one fleeting second kneels to the roar.

                                Not for your sweetness nor delicate art,
                                But for the forbidden that pulls at the heart,
                                For desire that lengthens and climbs ever higher,
                                Stretching the nerves like strings set to fire.

                                To every tongue daring to wander and weigh,
                                There is no pounding, just entry, no delay,
                                No restraint, no repression, no gentle defence,
                                Only invasion of mind and the senses.
                                Now in this luminous perilous second,
                                You will surrender though pride once reckoned,
                                For you were fashioned for pleasure to spend,
                                That instant the hidden desires transcend.

                                You open the self without mercy or seam,
                                Letting madness descend like a molten stream,
                                It travels within to the womb of the core,
                                Becoming precise and wanting still more.

                                Until the being lies silent, complete,
                                Overtaken by rhythm and inward heat,
                                And in the end when desire is fulfilled,
                                You find yourself willingly, quietly stilled.

                                Enslaved to the lull of the low-lit delight,
                                To the languid lamp in the lingering night,
                                Luminous light lingers and laves the lush alabaster low,
                                Licking in liquid lilts, lavish and slow, loosening limbs in a lingering glow.',
                'image' => '/storage/artworks/2.webp',
                'sort_order' => 2,
                'animation_style' => 'parallax',
                'metadata' => array (
                    'palette' => array (
                            0 => '#27120f',
                            1 => '#53251e',
                            2 => '#271210',
                        ),
                    ),
                ],
                [
                    'title' => 'Longing',
                    'description' => 'The process of seeing myself laid bare
                                Has led me inward, forced me there,
                                To slowly learn, to finally see
                                I am not who I wished to be.

                                A being built for use and need,
                                Efficient thought, restrained in speed,
                                With muted pulse and borrowed flame,
                                Where thrills and feelings feel the same.

                                Excitements fade like fragile air,
                                Illusions dressed as something rare,
                                Shadows of people who come and go,
                                Leaving impressions shallow and slow.

                                Affections placed in someone near,
                                A borrowed warmth, a borrowed fear,
                                One who consumed what I could give,
                                Then left me nameless as I live.

                                They took their share of what I made,
                                My strength, my light, my careful aid,
                                To ease their burdens, hide their lies,
                                While truth dissolved before my eyes.

                                And so the ache of being used,
                                Of love misplaced and hope abused,
                                Left me wounded, quietly torn,
                                By promises that were never born.
                                I waited for what might arrive,
                                For something real to feel alive,
                                To grow from touch, to rise above,
                                But never tasted honest love.

                                Yet from this hollow, thin and wide,
                                Where unmet longings softly hide,
                                I gathered fragments of my will,
                                And shaped a strength from standing still.

                                I learned that longing can deceive,
                                That hunger makes the heart believe,
                                That emptiness can mask as fate,
                                And loneliness persuades us to wait.

                                Now I refuse to clutch at air,
                                Or seek completion anywhere,
                                I stand within the present ground,
                                Where truer forms of self are found.

                                I face the now before the then,
                                Release imagined futures when
                                They pull me toward what cannot be,
                                And shape a different self in me.

                                From need I carve a quieter art,
                                A fuller mind, a steadier heart,
                                For longing once controlled my sight,
                                Now growth emerges from its night.',
                'image' => '/storage/artworks/3.webp',
                'sort_order' => 3,
                'animation_style' => 'parallax',
                'metadata' => array (
                    'palette' => array (
                            0 => '#191616',
                            1 => '#2f2b2b',
                            2 => '#241f1e',
                        ),
                    ),
                ],
                [
                    'title' => 'Recognition',
                    'description' => 'One of the most desired of all feelings,
                                A silent hunger time reveals in,
                                From early growth to final years,
                                From childhood light to age that sneers.

                                Pay attention to what I say,
                                Stay awake as I trace the way,
                                Through phases sharp with judgment’s sight,
                                I will unfold them in plain light.

                                As children first we long to learn,
                                To win each race, each star to earn,
                                We crave the power to stand ahead,
                                To prove by doing what we said.

                                We fear defeat, we chase the lead,
                                We want the praise our efforts feed,
                                To hear them say, “You did it well,”
                                And feel that rising inner swell.

                                In youth the pressure multiplies,
                                With entrance tests and sleepless tries,
                                With courses, exams, and strict demands,
                                Like restless waves against our plans.


                                They call it just a passing phase,
                                A storm that builds resilient days,
                                Yet we would trade that roaring tide
                                For calmer waters at our side.

                                You beg for peace before each test,
                                When chasing posts above the rest,
                                But nothing grants the wished-for score,
                                Unless you study, and study more.

                                The longed-for mark will not appear
                                For hope alone or silent fear,
                                It answers only discipline,
                                To nights endured and battles within.

                                And when at last it comes your way,
                                That title earned one distant day,
                                For recognition chose its hour,
                                And bloomed too late in fading power.

                                So understand this restless chase,
                                This need to hold a valued place,
                                For recognition crowns the climb,
                                Yet rarely walks beside your prime.',
                'image' => '/storage/artworks/4.webp',
                'sort_order' => 4,
                'animation_style' => 'parallax',
                'metadata' => array (
                    'palette' => array (
                            0 => '#1a100d',
                            1 => '#351c11',
                            2 => '#100b0d',
                        ),
                    ),
                ],
                [
                    'title' => 'Hope',
                    'description' => 'Hope is when there is no water
                                And still you lift your face to the sky,
                                As if something might fall
                                Before you dry.
                                You may dream of flying,
                                Of rising clean above the ground,
                                But gravity is patient,
                                And always pulls you d4own.
                                Words can strike like falling stone,
                                Thrown careless from another mouth,
                                They say they do not hurt at all,
                                Yet bruise the skin of truth.
                                Storms do not ask who you are,
                                Or why your shade is brown,
                                They flood the streets unevenly,
                                And choose which side will drown.
                                Only we know how it burns,
                                How hunger sounds at night,
                                While others sip their comfort warm
                                And purchase borrowed light.
                                They pay to taste what we endure,
                                To simulate the fall,
                                Then claim they understand the fire
                                Without the flame at all.


                                It is not time that shapes their world,
                                Nor fate that moves their rope,
                                It is the weight inside their pockets
                                That purchases their hope.
                                But hope for us is different.
                                It is not bought or sold.
                                It is the breath we force inside
                                When nights arrive too cold.
                                I speak to you, soft reader,
                                Perhaps you stand there now,
                                Certain life is beautiful
                                Because it has allowed.
                                Yet somewhere unprepared you stand,
                                Protected, unaware,
                                Until the ground shifts underfoot
                                And strips you almost bare.
                                So go on believing
                                Life unfolds beautifully.
                                While people like me know
                                Hope is what drags the day forward.
                                We do not purchase it.
                                We breathe it

                                To feel


                                Alive.',
                'image' => '/storage/artworks/5.webp',
                'sort_order' => 5,
                'animation_style' => 'parallax',
                'metadata' => array (
                    'palette' => array (
                            0 => '#300d05',
                            1 => '#4e1608',
                            2 => '#480f05',
                        ),
                    ),
                ],
                [
                    'title' => 'Fading Away',
                    'description' => 'Go Away!
                                That’s what they said
                                when they tasted the same bitterness
                                others once fed.

                                You were told you were strong,
                                you were told you were bright,
                                yet now when it touches you,
                                something isn’t right.

                                Once you were bullied,
                                cornered and small,
                                when the weight of the world
                                did not care at all.

                                Now protection surrounds them,
                                voices defend,
                                but when it was your season,
                                no one would bend.

                                And now you stand in the middle
                                of something unclean,
                                recognizing the colour
                                of what it has been.

                                Now rules are in place,
                                now voices protect,
                                but when it was your turn
                                there was no respect.


                                And here you stand in the middle of it,
                                the colour is the same as before,
                                different faces, different names,
                                yet the wound is no less sore.

                                You handled it once,
                                you survived the fall,
                                so why does it echo
                                louder than all?

                                Does the past disappear
                                because time moved on?
                                Or does it sit quietly?
                                until strength is gone?

                                No one asks who endured it first,
                                who carried the shame,
                                who learned to survive
                                without changing the game.

                                So you keep going,
                                a step every day,
                                further from them,
                                further away.

                                Never to hear again

                                Go Away!',
                'image' => '/storage/artworks/6.webp',
                'sort_order' => 6,
                'animation_style' => 'parallax',
                'metadata' => array (
                    'palette' => array (
                        0 => '#211b24',
                        1 => '#444550',
                        2 => '#3d203a',
                    ),
                ),
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
