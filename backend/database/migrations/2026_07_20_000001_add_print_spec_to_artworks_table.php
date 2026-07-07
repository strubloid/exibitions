<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('artworks', function (Blueprint $table) {
            $table->bigInteger('print_variant_id')->nullable()->after('is_available');
            $table->string('print_external_id', 64)->nullable()->after('print_variant_id');
            $table->bigInteger('print_markup_cents')->default(0)->after('print_external_id');
            $table->boolean('print_enabled')->default(false)->after('print_markup_cents');
        });
    }

    public function down(): void
    {
        Schema::table('artworks', function (Blueprint $table) {
            $table->dropColumn(['print_variant_id', 'print_external_id', 'print_markup_cents', 'print_enabled']);
        });
    }
};