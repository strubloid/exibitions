<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            $table->string('provider', 32)->default('stripe');
            $table->string('provider_session_id', 255)->nullable();
            $table->string('provider_payment_intent_id', 255)->nullable();
            $table->bigInteger('amount_cents');
            $table->char('currency', 3);
            $table->string('status', 32);
            $table->jsonb('raw_response')->nullable();
            $table->timestampsTz();
            $table->index('order_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payments');
    }
};