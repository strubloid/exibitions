<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('artworks', function (Blueprint $table) {
            $table->string('image_compressed')->nullable()->after('image');
        });

        Schema::table('exhibitions', function (Blueprint $table) {
            $table->string('cover_image_compressed')->nullable()->after('cover_image');
        });
    }

    public function down(): void
    {
        Schema::table('artworks', function (Blueprint $table) {
            $table->dropColumn('image_compressed');
        });

        Schema::table('exhibitions', function (Blueprint $table) {
            $table->dropColumn('cover_image_compressed');
        });
    }
};
