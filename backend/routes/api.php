<?php

use App\Http\Controllers\ArtworkController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return response()->json(['status' => 'ok', 'app' => 'Exibitions API']);
});

Route::get('/health', function () {
    return response()->json(['status' => 'ok']);
});

Route::get('/artworks', [ArtworkController::class, 'index']);
Route::post('/artworks/{artwork}/image', [ArtworkController::class, 'uploadImage']);
