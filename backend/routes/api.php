<?php

use App\Http\Controllers\ArtworkController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\CheckoutController;
use App\Http\Controllers\ExhibitionController;
use App\Http\Controllers\OrderController;
use App\Http\Controllers\WebhookController;
use Illuminate\Support\Facades\Route;

// Public read endpoints
Route::get('/artworks', [ArtworkController::class, 'index']);
Route::get('/exhibitions', [ExhibitionController::class, 'index']);
Route::get('/exhibitions/{slug}', [ExhibitionController::class, 'show']);
Route::post('/login', [AuthController::class, 'login']);

// Public checkout flow (guest checkout — no auth)
Route::post('/checkout/session', [CheckoutController::class, 'createSession'])
    ->middleware('throttle:30,1');
Route::get('/checkout/session/{sessionId}', [CheckoutController::class, 'status']);
Route::get('/checkout/success', [CheckoutController::class, 'success']);

// Stripe webhook — public, no auth, no CSRF; verified by signature.
Route::post('/webhooks/stripe', [WebhookController::class, 'stripe'])
    ->withoutMiddleware([\Illuminate\Foundation\Http\Middleware\VerifyCsrfToken::class]);

// Admin — requires Sanctum token AND is_admin check
Route::middleware(['auth:sanctum', 'admin'])->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);

    Route::post('/artworks', [ArtworkController::class, 'store']);
    Route::put('/artworks/{artwork}', [ArtworkController::class, 'update']);
    Route::delete('/artworks/{artwork}', [ArtworkController::class, 'destroy']);
    Route::post('/artworks/{artwork}/image', [ArtworkController::class, 'uploadImage']);
    Route::put('/artworks/{artwork}/price', [ArtworkController::class, 'updatePrice']);
    Route::get('/admin/artworks', [ArtworkController::class, 'adminIndex']);

    Route::post('/exhibitions', [ExhibitionController::class, 'store']);
    Route::put('/exhibitions/{exhibition}', [ExhibitionController::class, 'update']);
    Route::delete('/exhibitions/{exhibition}', [ExhibitionController::class, 'destroy']);
    Route::post('/exhibitions/{exhibition}/image', [ExhibitionController::class, 'uploadCover']);
    Route::post('/exhibitions/{exhibition}/clipping-screenshot', [ExhibitionController::class, 'uploadClippingScreenshot']);
    Route::post('/exhibitions/{exhibition}/artworks', [ExhibitionController::class, 'syncArtworks']);

    // Orders — admin only
    Route::get('/orders', [OrderController::class, 'index']);
    Route::get('/orders/{order}', [OrderController::class, 'show']);
});