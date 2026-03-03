<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return response()->json(['status' => 'ok', 'app' => 'Exibitions API']);
});

Route::get('/health', function () {
    return response()->json(['status' => 'ok']);
});
