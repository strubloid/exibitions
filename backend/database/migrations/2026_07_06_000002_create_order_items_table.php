<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('order_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            $table->foreignId('artwork_id')->constrained()->restrictOnDelete();
            $table->string('title_snapshot', 255);
            $table->string('image_snapshot', 255)->nullable();
            $table->bigInteger('unit_price_cents');
            $table->char('currency', 3);
            $table->timestampsTz();
            $table->index('order_id');
            $table->unique('artwork_id'); // one physical piece = one row per order
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('order_items');
    }
};