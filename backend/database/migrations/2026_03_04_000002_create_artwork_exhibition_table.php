<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('artwork_exhibition', function (Blueprint $table) {
            $table->foreignId('exhibition_id')->constrained()->cascadeOnDelete();
            $table->foreignId('artwork_id')->constrained()->cascadeOnDelete();
            $table->integer('sort_order')->default(0);
            $table->primary(['exhibition_id', 'artwork_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('artwork_exhibition');
    }
};
