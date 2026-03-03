<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\ArtworkController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return response()->json(['status' => 'ok', 'app' => 'Exibitions API']);
});

Route::get('/health', function () {
    return response()->json(['status' => 'ok']);
});

// Public
Route::get('/artworks', [ArtworkController::class, 'index']);
Route::post('/login', [AuthController::class, 'login']);

// Admin — requires Sanctum token
Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::post('/artworks', [ArtworkController::class, 'store']);
    Route::put('/artworks/{artwork}', [ArtworkController::class, 'update']);
    Route::delete('/artworks/{artwork}', [ArtworkController::class, 'destroy']);
    Route::post('/artworks/{artwork}/image', [ArtworkController::class, 'uploadImage']);
});
