<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('artworks', function (Blueprint $table) {
            $table->bigInteger('price_cents')->nullable()->after('image_compressed');
            $table->char('currency', 3)->nullable()->after('price_cents');
            $table->boolean('is_available')->default(true)->after('currency');
        });
    }

    public function down(): void
    {
        Schema::table('artworks', function (Blueprint $table) {
            $table->dropColumn(['price_cents', 'currency', 'is_available']);
        });
    }
};